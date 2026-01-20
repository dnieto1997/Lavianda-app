import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import axios from "axios";
import { Platform, Alert, PermissionsAndroid,AppState,Modal, View, Text, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

/* ----------------------------------------------------------
   IMPORTACIONES CONDICIONALES
---------------------------------------------------------- */
let Location: any = null;
let TaskManager: any = null;

if (Platform.OS !== "web") {
  Location = require("expo-location");
  TaskManager = require("expo-task-manager");
}

/* ----------------------------------------------------------
   CONFIG
---------------------------------------------------------- */
const API_BASE = "https://operaciones.lavianda.com.co/api";
const LOCATION_TASK_NAME = "background-location-task";

/* ----------------------------------------------------------
   CONTROL TRACKING
---------------------------------------------------------- */
const MIN_DISTANCE = 20;                 // metros para considerar movimiento
const MOVE_INTERVAL = 5000;              // 5 segundos
const STILL_INTERVAL = 10 * 60 * 1000;   // 10 minutos
const MAX_ACCURACY = 300;

/* ----------------------------------------------------------
   TYPES
---------------------------------------------------------- */
interface LocationContextType {
  startTracking: (token: string, type: string) => Promise<void>;
  startBackgroundTracking: () => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
  isTrackingActive: () => Promise<boolean>;
}

/* ----------------------------------------------------------
   STORAGE
---------------------------------------------------------- */
const STORAGE_KEYS = {
  TOKEN: "tracking_token",
  SESSION: "tracking_session",
  ACTIVE: "tracking_active",
  LAST_LOC: "tracking_last_location",
  LAST_TIME: "tracking_last_time",
  QUEUE: "tracking_queue", // 🆕
};

/* ----------------------------------------------------------
   HELPERS
---------------------------------------------------------- */
const haversine = (a: number, b: number, c: number, d: number) => {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLon = toRad(d - b);
  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(
        Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2
      ),
      Math.sqrt(
        1 -
          (Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a)) *
              Math.cos(toRad(c)) *
              Math.sin(dLon / 2) ** 2)
      )
    )
  );
};

const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const enqueueLocation = async (payload: any) => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push(payload);
  await AsyncStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
};








const flushQueue = async () => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  if (!token) return;

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.QUEUE);
  if (!raw) return;

  const queue = JSON.parse(raw);
  if (!queue.length) return;

  const remaining = [];

  for (const item of queue) {
    try {
      await axios.post(`${API_BASE}/locations`, item, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
    } catch {
      remaining.push(item); // ❌ no se pudo enviar
    }
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.QUEUE,
    JSON.stringify(remaining)
  );
};

const isGpsReallyEnabled = async (): Promise<boolean> => {
  if (Platform.OS === "web") return true;

  return await Location.hasServicesEnabledAsync();
};


const isGpsWorking = async (): Promise<boolean> => {
  try {
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
      timeout: 4000,
    });
    return true;
  } catch (e) {
    return false;
  }
};


/* ----------------------------------------------------------
   PERMISOS
---------------------------------------------------------- */
const requestPermissionsOrSettings = async (): Promise<boolean> => {
  if (Platform.OS === "web") return true;

  if (Platform.OS === "android" && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }

  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    fg = await Location.requestForegroundPermissionsAsync();
  }

  if (fg.status !== "granted") {
    Alert.alert(
      "Permiso requerido",
      "La app necesita acceso a tu ubicación",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  let bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    bg = await Location.requestBackgroundPermissionsAsync();
  }

  if (bg.status !== "granted") {
    Alert.alert(
      "Permiso en segundo plano",
      "Permite ubicación siempre",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }

  return true;
};

/* ----------------------------------------------------------
   BACKGROUND TASK
---------------------------------------------------------- */
if (Platform.OS !== "web" && TaskManager) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;

  const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
  const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
  if (!token || !sessionId) return;

  const loc = data.locations[data.locations.length - 1];
  const { latitude, longitude, accuracy = 999 } = loc.coords;
  if (accuracy > MAX_ACCURACY) return;

  const lastRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOC);
  const lastTimeRaw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_TIME);

  const now = Date.now();
  let shouldInsert = false;

  if (lastRaw && lastTimeRaw) {
    const last = JSON.parse(lastRaw);
    const dist = haversine(last.lat, last.lng, latitude, longitude);
    const elapsed = now - Number(lastTimeRaw);

    if (dist >= MIN_DISTANCE && elapsed >= MOVE_INTERVAL) shouldInsert = true;
    if (dist < MIN_DISTANCE && elapsed >= STILL_INTERVAL) shouldInsert = true;
  } else {
    shouldInsert = true;
  }

  if (!shouldInsert) return;

  const payload = {
    latitude,
    longitude,
    accuracy,
    timestamp: new Date(loc.timestamp)
      .toISOString()
      .slice(0, 19)
      .replace("T", " "),
    type: "tracking",
    session_id: sessionId,
  };

  // ✅ GUARDAR SIEMPRE
  await enqueueLocation(payload);

  // 🔁 INTENTAR ENVÍO
  await flushQueue();

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.LAST_LOC, JSON.stringify({ lat: latitude, lng: longitude })],
    [STORAGE_KEYS.LAST_TIME, now.toString()],
  ]);
});

}



/* ----------------------------------------------------------
   CONTEXT
---------------------------------------------------------- */
const LocationContext = createContext<LocationContextType | null>(null);

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation fuera del provider");
  return ctx;
};



/* ----------------------------------------------------------
   PROVIDER
---------------------------------------------------------- */
export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [gpsBlocked, setGpsBlocked] = React.useState(false);
const startTracking = useCallback(async (token: string, type: string) => {
  // 🔐 permisos
  const granted = await requestPermissionsOrSettings();
  if (!granted) return;
const gpsOk = await isGpsWorking();
if (!gpsOk) {
  setGpsBlocked(true);
  return;
}



  let loc = null;

  try {
    loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeout: 15000,
    });
  } catch {
    loc = await Location.getLastKnownPositionAsync();
  }

  let sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);

  // 🔐 LOGIN → nueva sesión
  if (type === "login") {
    sessionId = generateSessionId();
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.SESSION, sessionId],
      [STORAGE_KEYS.ACTIVE, "true"],
      [STORAGE_KEYS.TOKEN, token],
    ]);
  }

  const payload = {
    latitude: loc?.coords?.latitude ?? 0,
    longitude: loc?.coords?.longitude ?? 0,
    accuracy: loc?.coords?.accuracy ?? 9999,
    timestamp: loc
      ? new Date(loc.timestamp).toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " "),
    type,
    session_id: sessionId,
  };
  console.log("Payload inicial:", payload);

  // ✅ 1. GUARDAR SIEMPRE (offline-first)
  await enqueueLocation(payload);

  // 🔁 2. INTENTAR ENVIAR
  await flushQueue();

  // ▶️ TRACKING BACKGROUND
  if (type === "login") {
    await startBackgroundTracking();
  }

  // ⛔ LOGOUT
  if (type === "logout") {
    if (Platform.OS !== "web") {
      const registered =
        await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

      if (registered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    }

    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  }
}, []);

useEffect(() => {
  if (Platform.OS === "web") return;

  const interval = setInterval(async () => {
    const tracking =
      (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE)) === "true";

    if (!tracking) return;

    const gpsOk = await isGpsWorking();

    if (!gpsOk) {
      setGpsBlocked(true);
    } else {
      setGpsBlocked(false);
    }
  }, 3000); // 🔥 cada 2 segundos

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (Platform.OS === "web") return;

  const checkOnStartup = async () => {
    const tracking =
      (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE)) === "true";

    if (!tracking) return;

    const gpsOk = await isGpsWorking();
    if (!gpsOk) {
      setGpsBlocked(true);
    }
  };

  checkOnStartup();
}, []);
useEffect(() => {
  if (Platform.OS === "web") return;

  const sub = AppState.addEventListener("change", async (nextState) => {
    if (nextState !== "active") return;

    const tracking =
      (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE)) === "true";

    if (!tracking) return;

    const gpsOk = await isGpsWorking();
    setGpsBlocked(!gpsOk);
  });

  return () => sub.remove();
}, []);










  const startBackgroundTracking = useCallback(async () => {
    if (Platform.OS === "web") return;

    const registered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (registered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

   await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
  accuracy: Location.Accuracy.Highest,
  timeInterval: MOVE_INTERVAL, // 🔥 FUERZA EVENTOS CADA 5s
  distanceInterval: 0,         // Android ignora esto
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: "La Vianda",
    notificationBody: "Tracking activo",
  },
});

  }, []);

  const stopBackgroundTracking = useCallback(async () => {
  if (Platform.OS === "web") return;

  try {
    const registered =
      await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);

    if (registered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (e) {
    console.log("⚠️ Error stopping task", e);
  }

  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}, []);


  const isTrackingActive = async () =>
    (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE)) === "true";
  

  return (

    <LocationContext.Provider
      value={{
        startTracking,
        startBackgroundTracking,
        stopBackgroundTracking,
        isTrackingActive,
      }}
    >
      <Modal visible={gpsBlocked} transparent animationType="fade">
  <View
    style={{
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <View
      style={{
        width: "85%",
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 20,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}>
        GPS desactivado
      </Text>

      <Text style={{ textAlign: "center", marginBottom: 20 }}>
        Para continuar usando la aplicación debes activar el GPS.
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: "#1E3A8A",
          paddingVertical: 12,
          paddingHorizontal: 25,
          borderRadius: 8,
        }}
        onPress={() => {
          setGpsBlocked(false);
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "bold" }}>
          Cerrar
        </Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>


      {children}
    </LocationContext.Provider>
  );
};
