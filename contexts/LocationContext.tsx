// --- START OF FILE contexts/LocationContext.tsx (VERSIÓN OPTIMIZADA) ---

import React, { createContext, useContext, useCallback, ReactNode } from "react";
import axios from "axios";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ----------------------------------------------------------
   IMPORTACIONES CONDICIONALES (solo móvil)
---------------------------------------------------------- */
let Location: any = null;
let TaskManager: any = null;

if (Platform.OS !== "web") {
  try {
    Location = require("expo-location");
    TaskManager = require("expo-task-manager");
  } catch {
    console.log("⚠️ Expo Location no disponible");
  }
}

/* ----------------------------------------------------------
   CONFIG
---------------------------------------------------------- */
const API_BASE = "https://operaciones.lavianda.com.co/api";
const LOCATION_TASK_NAME = "background-location-task";

/* ----------------------------------------------------------
   TIPOS
---------------------------------------------------------- */
interface LocationContextType {
  startTracking: (
    token: string,
    type:
      | "login"
      | "logout"
      | "Acta_de_Inicio"
      | "Formulario_Inpeccion"
      | "Informe_de_Supervisión"
      | "Inicio_servicio"
      | "Novedades_servicio"
  ) => Promise<void>;

  startBackgroundTracking: (token: string, sessionId: string) => Promise<void>;

  stopBackgroundTracking: () => Promise<void>;

  isTrackingActive: () => Promise<boolean>;
}

/* ----------------------------------------------------------
   STORAGE KEYS
---------------------------------------------------------- */
const STORAGE_KEYS = {
  TOKEN: "tracking_token",
  SESSION: "tracking_session",
  ACTIVE: "tracking_active",
  LAST_LOC: "tracking_last_location", // { lat, lng, ts }
};

/* ----------------------------------------------------------
   UTIL HELPERS
---------------------------------------------------------- */
const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // metres
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const saveLastLocation = async (lat: number, lng: number) => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_LOC,
      JSON.stringify({ lat, lng, ts: Date.now() })
    );
  } catch (err) {
    console.log("⚠️ Error guardando last loc", err);
  }
};

const getLastLocation = async (): Promise<{ lat: number; lng: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOC);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.lat != null && parsed.lng != null) return { lat: parsed.lat, lng: parsed.lng };
    return null;
  } catch (err) {
    console.log("⚠️ Error leyendo last loc", err);
    return null;
  }
};

/* ----------------------------------------------------------
   BACKGROUND TASK (Solo móvil)
---------------------------------------------------------- */
if (Platform.OS !== "web" && TaskManager) {
  TaskManager.defineTask(
    LOCATION_TASK_NAME,
    async ({ data, error }: { data: any; error: any }) => {
      if (error) {
        console.log("❌ Error BACKGROUND TASK:", error);
        return;
      }

      if (!data) return;
      const { locations } = data;
      if (!locations || locations.length === 0) return;

      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
        const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
        if (!token || !sessionId) {
          // no token/session -> nada que enviar
          return;
        }

        const lastLoc = await getLastLocation();

        for (const loc of locations) {
          if (!loc.coords) continue;

          const { latitude, longitude, accuracy, speed = 0, heading = 0, altitude = 0 } = loc.coords;

          // FILTRO: descartamos points sin accuracy o con accuracy alta (> 20m)
          if (!accuracy || accuracy > 20) {
            console.log("⛔ Punto descartado en BG por precisión (>20m):", accuracy);
            continue;
          }

          // FILTRO: descartamos saltos enormes respecto al último punto enviado (si existe)
          if (lastLoc) {
            const dist = haversineDistanceMeters(lastLoc.lat, lastLoc.lng, latitude, longitude);
            // Si la distancia es muy grande y la precisión no es perfecta, descartamos
            if (dist > 200 && accuracy > 15) {
              console.log("⛔ Punto descartado en BG por salto detectado:", Math.round(dist), "m, accuracy:", accuracy);
              continue;
            }
          }

          const payload = {
            latitude,
            longitude,
            accuracy,
            speed,
            heading,
            altitude,
            timestamp: new Date(loc.timestamp).toISOString().slice(0, 19).replace("T", " "),
            type: "tracking",
            session_id: sessionId,
          };

          try {
            await axios.post(`${API_BASE}/locations`, payload, {
              headers: { Authorization: `Bearer ${token}` },
            });
            // Guardar último punto exitoso
            await saveLastLocation(latitude, longitude);
            // actualizar lastLoc en memoria para el siguiente ciclo
            if (lastLoc) {
              lastLoc.lat = latitude;
              lastLoc.lng = longitude;
            }
            console.log("📡 Punto BG enviado:", payload.timestamp, "acc:", accuracy);
          } catch (err) {
            console.log("❌ Error enviando punto BG:", err);
            // no hacemos retry intensivo aquí para ahorrar batería/data
          }
        }
      } catch (err) {
        console.log("❌ Error en background task principal:", err);
      }
    }
  );
}

/* ----------------------------------------------------------
   CONTEXTO
---------------------------------------------------------- */
const LocationContext = createContext<LocationContextType | null>(null);

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation debe usarse dentro de <LocationProvider>");
  return ctx;
};

/* ----------------------------------------------------------
   PROVIDER
---------------------------------------------------------- */
export const LocationProvider = ({ children }: { children: ReactNode }) => {
  /* ----------------------------------------------------------
     FUNCIONES AUXILIARES
  ---------------------------------------------------------- */
  const sendLocation = async (token: string, data: any) => {
    return axios.post(`${API_BASE}/locations`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  };

  /* ----------------------------------------------------------
     TRACKING PUNTUAL (login, logout, formularios)
     - No enviar si accuracy > 20
  ---------------------------------------------------------- */
  const startTracking = useCallback(
    async (
      token: string,
      type:
        | "login"
        | "logout"
        | "Acta_de_Inicio"
        | "Formulario_Inpeccion"
        | "Informe_de_Supervisión"
        | "Inicio_servicio"
        | "Novedades_servicio"
    ) => {
      try {
        let latitude = 0,
          longitude = 0,
          accuracy = 0,
          altitude = 0,
          speed = 0,
          heading = 0,
          timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        if (Platform.OS === "web") {
          /* ------------------------------------------
             TRACKING WEB
          ------------------------------------------ */
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                latitude = pos.coords.latitude;
                longitude = pos.coords.longitude;
                accuracy = pos.coords.accuracy ?? 9999;
                altitude = pos.coords.altitude ?? 0;
                heading = pos.coords.heading ?? 0;
                speed = pos.coords.speed ?? 0;
                resolve(true);
              },
              (err) => {
                console.log("⚠️ Geolocation error web:", err);
                resolve(true); // NO BLOQUEA EL LOGIN
              },
              { enableHighAccuracy: true, timeout: 7000 }
            );
          });
        } else {
          /* ------------------------------------------
             TRACKING MÓVIL (foreground instant)
          ------------------------------------------ */
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") throw new Error("Permiso denegado");

          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });

          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          accuracy = loc.coords.accuracy ?? 9999;
          altitude = loc.coords.altitude ?? 0;
          heading = loc.coords.heading ?? 0;
          speed = loc.coords.speed ?? 0;
          timestamp = new Date(loc.timestamp).toISOString().slice(0, 19).replace("T", " ");
        }

        // FILTRO: no enviar login/logout/formularios si precision > 20m
        if (!accuracy || accuracy > 20) {
          console.log("⛔ Punto LOGIN/FORM descartado por precisión (>20m):", accuracy);
          return;
        }

        const payload = {
          latitude,
          longitude,
          accuracy,
          altitude,
          heading,
          speed,
          timestamp,
          type,
          session_id: `${type}_${Date.now()}`,
        };

        try {
          await sendLocation(token, payload);
          // guardar último punto enviado para comparaciones futuras
          await saveLastLocation(latitude, longitude);
          console.log("📌 Punto enviado:", type, "acc:", accuracy);
        } catch (err) {
          console.log("❌ Error enviando punto puntual:", err);
        }
      } catch (err) {
        console.log("❌ Error en startTracking:", err);
      }
    },
    []
  );

  /* ----------------------------------------------------------
     TRACKING EN BACKGROUND (solo móvil)
     - Usar BestForNavigation
     - Umbral de precision y filtros para saltos
  ---------------------------------------------------------- */
  const startBackgroundTracking = useCallback(
    async (token: string, sessionId: string) => {
      if (Platform.OS === "web") return;

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, sessionId);
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE, "true");
      } catch (err) {
        console.log("⚠️ Error guardando storage:", err);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permiso foreground denegado");
        return;
      }

      await Location.requestBackgroundPermissionsAsync();

      const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

      // Opciones más estables y eficientes
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 60000, // 5s
        distanceInterval: 8, // 8m
        // pausesUpdatesAutomatically: true, // dependiendo del caso; dejar false evita pausar en algunos dispositivos
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "La Vianda",
          notificationBody: "Tracking activo",
        },
      });

      console.log("🚀 Background tracking INICIADO (BestForNavigation, 5s/8m)");
    },
    []
  );

  const stopBackgroundTracking = useCallback(async () => {
    if (Platform.OS !== "web") {
      const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
      await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE);
    } catch (err) {
      console.log("⚠️ Error limpiando storage", err);
    }

    console.log("🛑 Tracking detenido");
  }, []);

  const isTrackingActive = useCallback(async () => {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE)) === "true";
    } catch {
      return false;
    }
  }, []);

  /* ----------------------------------------------------------
     PROVIDER RETURN
  ---------------------------------------------------------- */
  return (
    <LocationContext.Provider
      value={{
        startTracking,
        startBackgroundTracking,
        stopBackgroundTracking,
        isTrackingActive,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

// --- END OF FILE ---
