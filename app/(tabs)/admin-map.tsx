// app/(tabs)/admin-map.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRealTimeTracking } from "@/hooks/useRealTimeTracking";
import { useAuth } from "../_layout";
import axios from "axios";

let MapView: any;
let Marker: any;
let Polyline: any;

if (Platform.OS === "web") {
  const {
    GoogleMap,
    Marker: GoogleMarker,
    Polyline: GooglePolyline,
    useJsApiLoader,
  } = require("@react-google-maps/api");

  MapView = ({ children, center, zoom = 13 }: any) => {
    const { isLoaded, loadError } = useJsApiLoader({
      googleMapsApiKey: "YOUR_GOOGLE_MAPS_KEY",
      libraries: ["places"],
    });

    if (loadError)
      return (
        <div style={{ width: "100%", height: "100%" }}>Error loading map</div>
      );
    if (!isLoaded)
      return (
        <div style={{ width: "100%", height: "100%" }}>Loading map...</div>
      );

    return (
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={zoom}
        options={{ disableDefaultUI: false, zoomControl: true }}
      >
        {children}
      </GoogleMap>
    );
  };

  Marker = GoogleMarker;
  Polyline = GooglePolyline;
} else {
  const RNMaps = require("react-native-maps");
  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
  Polyline = RNMaps.Polyline;
}

const { height } = Dimensions.get("window");

const defaultRegion = {
  latitude: 10.9878,        // Latitud de Barranquilla
  longitude: -74.7889,      // Longitud de Barranquilla
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};


const COLORS = [
  "#2196F3",
  "#4CAF50",
  "#FF9800",
  "#9C27B0",
  "#E91E63",
  "#009688",
  "#795548",
  "#3F51B5",
  "#F44336",
];

export default function AdminMap() {
  const {
    userLocations,
    loading,
    isConnected,
    refreshData,
    connectWebSocket,
    disconnectWebSocket,
    fetchUserLocationsByDate,
    fetchFormMarkers,
    selectedUserRoute,
    startLiveTracking,
    
  
  } = useRealTimeTracking();

  const { user } = useAuth() as { user: any | null };

  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDateModal, setShowDateModal] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const mapRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);

  // === HELPERS ===
  const getUserMarkerColor = (u: any) => {
    if (!u.isOnline) return "#808080";
    if (u.speed > 5) return "#ff4444";
    if (u.speed > 1) return "#ffaa00";
    return "#44ff44";
  };

  

  const formTypes = [
    "Acta_de_Inicio",
    "Formulario_Inpeccion",
    "Informe_de_Supervisión",
    "Inicio_servicio",
    "Novedades_servicio",
    "cronograma",
    "acta_reunion"
  ];
  const formatearNombre = (texto: string) => {
  return texto.replace(/_/g, " "); // quita _
};

  const centerMapOn = (lat: number, lng: number, zoom = 16) => {
    if (!mapRef.current) return;
    if (Platform.OS === "web") {
      mapRef.current.panTo({ lat, lng });
      if (mapRef.current.setZoom) mapRef.current.setZoom(zoom);
    } else {
      mapRef.current.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      );
    }
  };

  // === DOUBLE TAP ===
  const handleDoubleTap = (u: any) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      centerMapOn(Number(u.latitude), Number(u.longitude), 16);
    }
    lastTapRef.current = now;
  };

  // === SEARCH USERS ===
  const fetchUsersBySearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setFilteredUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const url = `https://operaciones.lavianda.com.co/api/admin/users/search?q=${encodeURIComponent(
        q
      )}`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json',
            'Accept': 'application/json' },
      });
      setFilteredUsers(resp.data?.data ?? []);
    } catch (err) {
      console.error("Error buscando usuarios", err);
      setFilteredUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

useEffect(() => {
  const load = async () => {
    await refreshData();
  };

  load();
}, []);

  // === SELECT USER + DATE ===
  const handleUserSelect = async (
    userId: number,
    date: Date = selectedDate
  ) => {
    setSelectedUser(userId);
    setSelectedDate(date);
    try {
      await startLiveTracking(userId);
      const formattedDate = formatDateLocal(date);
      await fetchUserLocationsByDate(userId, formattedDate);

      await fetchFormMarkers(userId, formattedDate);
    } catch (err) {
      console.error(err);
    }
  };

/*   // === AUTO REFRESH EVERY 30s IF TODAY ===
  useEffect(() => {
    if (!selectedUser) return;
    const isToday = formatDate(selectedDate) === formatDate(new Date());
    if (!isToday) return;
    const interval = setInterval(() => {
      fetchUserLocationsByDate(selectedUser, formatDate(selectedDate));
      fetchFormMarkers(selectedUser, formatDate(selectedDate));
    }, 40000);
    return () => clearInterval(interval);
  }, [selectedUser, selectedDate]); */




  // === GROUP ROUTES BY sessionId ===
  const groupedRoutes = React.useMemo(() => {
    if (!selectedUserRoute || selectedUserRoute.length === 0) return [];
    const groups: Record<string, any[]> = {};
    for (const p of selectedUserRoute) {
      if (!groups[p.sessionId]) groups[p.sessionId] = [];
      groups[p.sessionId].push(p);
    }
    return Object.entries(groups).map(([sessionId, points], i) => ({
      sessionId,
      color: COLORS[i % COLORS.length],
      points: points.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    }));
  }, [selectedUserRoute]);

const segmentedRoutes = React.useMemo(() => {
  return groupedRoutes.map((r) => {
    const segments: any[] = [];
    let currentSegment: any[] = [];

    for (const p of r.points.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )) {

      // Si es logout — cortar la línea
    if (p.type === "login" || p.type === "logout") {
  
  // cerrar el segmento ACTUAL
  if (currentSegment.length > 0) {
    segments.push([...currentSegment]);
    currentSegment = [];
  }

  continue; // login/logout NO entran al polyline
}

      // SOLO tracking entra en la ruta
      if (p.type === "tracking" && p.latitude && p.longitude) {
        currentSegment.push(p);
      }

      // login, formularios, etc. NO entran en el polyline
      // solo se mostrarán como markers
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return {
      ...r,
      segments,
    };
  });
}, [groupedRoutes]);



  // === RENDER MAP ===
  const renderMap = () => {
    if (!MapView) return null;

    const userMarkers = userLocations.map((u) => (
      <Marker
        key={`user-${u.id}`}
        coordinate={
          Platform.OS === "web"
            ? { lat: Number(u.latitude), lng: Number(u.longitude) }
            : { latitude: Number(u.latitude), longitude: Number(u.longitude) }
        }
        title={u.name}
        pinColor={getUserMarkerColor(u)}
        onPress={() => handleDoubleTap(u)}
      />
    ));

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        onMapReady={() => setIsMapReady(true)}
      >
        {/* Usuarios */}
        {userMarkers}

        {/* Rutas separadas por sessionId */}
        {/* Rutas segmentadas por sessionId (no cortadas por formularios) */}
{segmentedRoutes.map((r) =>
  r.segments.map((segment: any, idx: number) => {
    const coords = segment.map((p: any) =>
      Platform.OS === "web"
        ? { lat: Number(p.latitude), lng: Number(p.longitude) }
        : {
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
          }
    );

    return coords.length > 1 ? (
      <Polyline
        key={`seg-${r.sessionId}-${idx}`}
        path={Platform.OS === "web" ? coords : undefined}
        coordinates={Platform.OS !== "web" ? coords : undefined}
        strokeColor="#2196F3"   // color por sesión
        strokeWidth={4}
      />
    ) : null;
  })
)}



        {/* Formularios */}
       {groupedRoutes.flatMap((r, i) =>
  r.points
    .filter((p) => formTypes.includes(p.type))
    .map((p, idx) => (
      <Marker
        key={`form-${r.sessionId}-${idx}`}
        coordinate={
          Platform.OS === "web"
            ? { lat: Number(p.latitude), lng: Number(p.longitude) }
            : {
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
              }
        }
        onPress={() => {
          setSelectedMarker({
            ...p,
            type: p.type.replace(/_/g, " "),
          });
        }}
      >
        <View style={[styles.formMarker, { borderColor: r.color }]}>
          <Ionicons
            name="clipboard-outline"
            size={18}
            color={r.color}
          />
        </View>
      </Marker>
    ))
)}


{/* LOGIN / LOGOUT */}
{groupedRoutes.flatMap((r) =>
  r.points
    .filter((p) => p.type === "login" || p.type === "logout")
    .map((p, idx) => (
      <Marker
        key={`log-${r.sessionId}-${idx}`}
        coordinate={
          Platform.OS === "web"
            ? { lat: Number(p.latitude), lng: Number(p.longitude) }
            : {
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
              }
        }
        onPress={() =>
          setSelectedMarker({
            ...p,
            type: p.type === "login" ? "Inicio de sesión" : "Fin de sesión",
          })
        }
      >
        <View
          style={{
            backgroundColor: p.type === "login" ? "#4CAF50" : "#F44336",
            padding: 6,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: "#fff",
          }}
        >
          <Ionicons
            name={p.type === "login" ? "log-in-outline" : "log-out-outline"}
            size={10}
            color="#fff"
          />
        </View>
      </Marker>
    ))
)}

      </MapView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
    <View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()}>
    <Ionicons name="arrow-back" size={24} color="#fff" />
  </TouchableOpacity>

  <Text style={styles.headerTitle}>Mapa</Text>

  <View style={styles.refreshContainer}>
    <TouchableOpacity onPress={refreshData} style={styles.refreshButton}>
      <Ionicons name="refresh" size={22} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.refreshText}>Actualizar ubicaciones</Text>
  </View>
</View>


      {/* Map */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        ) : (
          renderMap()
        )}
      </View>

      {/* Info panel */}
      <Text style={styles.updateRoutesText}>Actualizar recorridos</Text>

      <ScrollView
        style={styles.userList}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshData} />
        }
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuario..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={fetchUsersBySearch}
          />
          <TouchableOpacity
            onPress={fetchUsersBySearch}
            style={styles.searchButton}
          >
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {(searchQuery.trim() ? filteredUsers : userLocations).map((u) => (
          <View
            key={u.id}
            style={[
              styles.userItem,
              selectedUser === u.id && styles.userItemSelected,
            ]}
          >
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              onPress={() => handleUserSelect(u.id)}
              onPressOut={() => handleDoubleTap(u)}
            >
              <Text style={styles.userName}>{u.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedUser(u.id);
                  setShowDateModal(true);
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#2196F3"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            </TouchableOpacity>
            <Text style={styles.userStatus}>
              {u.isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Date Picker */}
      {showDateModal && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(e, d) => {
            setShowDateModal(false);
            if (d && selectedUser) handleUserSelect(selectedUser, d);
          }}
        />
      )}

      {/* Marker Info */}
      {selectedMarker && (
        <View style={styles.markerInfoBox}>
          <Text style={styles.markerInfoTitle}>{selectedMarker.type}</Text>
          <Text>{selectedMarker.timestamp}</Text>
          <TouchableOpacity
            onPress={() => setSelectedMarker(null)}
            style={styles.closeInfoButton}
          >
            <Text style={{ color: "#fff" }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// === STYLES ===
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f0f0" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f32121",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchContainer: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#fff",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#eee",
    borderRadius: 8,
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 8,
  },
  userList: { maxHeight: height * 0.33, backgroundColor: "#fff" },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  userItemSelected: { backgroundColor: "#FFFFFF" },
  userName: { fontSize: 14 },
  userStatus: { fontSize: 12, color: "#555" },
  formMarker: {
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#007BFF",
  },
  markerInfoBox: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    elevation: 5,
  },
  updateRoutesText: {
  textAlign: "center",
  fontSize: 15,
  color: "black",
  marginBottom: 6,
  fontWeight: "500",
},

  refreshContainer: {
  alignItems: "center",
  justifyContent: "center",
},

refreshButton: {
  padding: 4,
},

refreshText: {
  marginTop: 2,
  fontSize: 12,
  color: "rgba(255,255,255,0.85)",
  fontWeight: "500",
},

  markerInfoTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 4 },
  closeInfoButton: {
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: "#2196F3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
