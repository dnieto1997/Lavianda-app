import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRealTimeTracking } from '@/hooks/useRealTimeTracking';

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

// --- Configuración de mapas según plataforma ---
if (Platform.OS === 'web') {
  try {
    const GoogleMaps = require('@react-google-maps/api');
    MapView = GoogleMaps.GoogleMap;
    Marker = GoogleMaps.Marker;
    Polyline = GoogleMaps.Polyline;
  } catch (error) {
    console.warn('Google Maps no disponible en web');
  }
} else {
  try {
    const RNMaps = require('react-native-maps');
    MapView = RNMaps.default;
    Marker = RNMaps.Marker;
    Polyline = RNMaps.Polyline;
  } catch (error) {
    console.warn('React Native Maps no disponible');
  }
}

const { height } = Dimensions.get('window');

const defaultRegion = {
  latitude: 4.60971,
  longitude: -74.08175,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function AdminMapRedirect() {
  const {
    userLocations,
    formMarkers,
    loading,
    isConnected,
    refreshData,
    connectWebSocket,
    disconnectWebSocket,
    fetchUserLocationsByDate,
    selectedUserRoute,
    fetchFormMarkers,
  } = useRealTimeTracking();

  const [viewMode, setViewMode] = useState<'all' | 'routes' | 'forms'>('all');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const mapRef = useRef<any>(null);

  // === Colores de markers ===
  const getUserMarkerColor = (user: any) => {
    if (!user.isOnline) return '#808080';
    if (user.speed && user.speed > 5) return '#ff4444';
    if (user.speed && user.speed > 1) return '#ffaa00';
    return '#44ff44';
  };

  const getTrackingMarkerColor = (type: string) => {
    switch (type) {
      case 'login':
        return '#4CAF50';
      case 'logout':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const getFormMarkerColor = (form: any) =>
    form.type === 'form_start' ? '#4CAF50' : '#FF9800';

  // === Abrir calendario ===
 const openDatePicker = (userId?: number) => {
  setShowDateModal(true);
  if (userId) setSelectedUser(userId);
};

  const onDateConfirm = async (event: any, date?: Date) => {
  if (Platform.OS === 'android') setShowDateModal(false);
  if (!date || !selectedUser) return;

  const formattedDate = date.toISOString().split('T')[0];
  setSelectedDate(date);

  try {
    // 🔥 Obtener rutas y formularios del usuario directamente
    await fetchUserLocationsByDate(selectedUser, formattedDate);
    await fetchFormMarkers(selectedUser, formattedDate);

    // 🔍 Centrar mapa automáticamente al primer punto
    if (mapRef.current && selectedUserRoute.length > 0) {
      const firstPoint = selectedUserRoute[0];
      if (Platform.OS === 'web') {
        mapRef.current.panTo({
          lat: firstPoint.latitude,
          lng: firstPoint.longitude,
        });
        mapRef.current.setZoom(15);
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: firstPoint.latitude,
            longitude: firstPoint.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000
        );
      }
    }
  } catch (error) {
    console.error('Error al obtener rutas o formularios:', error);
  }
};

  // === Renderizar mapa ===
  const renderMap = () => {
    if (!MapView) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            Mapa no disponible en esta plataforma
          </Text>
        </View>
      );
    }

    // --- WEB ---
    if (Platform.OS === 'web') {
      const hasGoogle = typeof window !== 'undefined' && (window as any).google;

      return (
        <MapView
          ref={mapRef}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{
            lat: defaultRegion.latitude,
            lng: defaultRegion.longitude,
          }}
          zoom={12}
        >
          {/* Usuarios */}
          {(viewMode === 'all' || viewMode === 'routes') &&
            userLocations.map(user => (
              <Marker
                key={`user-${user.id}`}
                position={{ lat: user.latitude, lng: user.longitude }}
                title={`${user.name} (${user.isOnline ? 'Online' : 'Offline'})`}
                icon={
                  hasGoogle
                    ? {
                        path: (window as any).google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: getUserMarkerColor(user),
                        fillOpacity: 0.8,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }
                    : undefined
                }
              />
            ))}

          {/* Rutas y eventos */}
          {(viewMode === 'all' || viewMode === 'routes') && (
            <>
              {/* Login / Logout */}
              {selectedUserRoute
                .filter(p => p.type === 'login' || p.type === 'logout')
                .map((p, i) => (
                  <Marker
                    key={`event-${i}`}
                    position={{ lat: p.latitude, lng: p.longitude }}
                    title={p.type === 'login' ? 'Login' : 'Logout'}
                    icon={
                      hasGoogle
                        ? {
                            path: (window as any)
                              .google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                            scale: 6,
                            fillColor: getTrackingMarkerColor(p.type),
                            fillOpacity: 0.9,
                            strokeColor: '#fff',
                            strokeWeight: 1,
                          }
                        : undefined
                    }
                  />
                ))}

              {/* Tracking (líneas) */}
              {selectedUserRoute.filter(p => p.type === 'tracking').length > 0 && (
                <Polyline
                  path={selectedUserRoute
                    .filter(p => p.type === 'tracking')
                    .map(p => ({ lat: p.latitude, lng: p.longitude }))}
                  options={{
                    strokeColor: '#000000ff',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                  }}
                />
              )}
            </>
          )}

          {/* === FORMULARIOS === */}
          {(viewMode === 'forms' || viewMode === 'all') &&
            selectedUserRoute
              .filter(p => p.type === 'form_start')
              .map((p, i) => (
                <Marker
                  key={`formstart-${i}`}
                  position={{ lat: p.latitude, lng: p.longitude }}
                  title="Inicio de Formulario"
                  icon={
                    hasGoogle
                      ? {
                          url: '/icons/form-icon.svg',
                          scaledSize: new (window as any).google.maps.Size(32, 32),
                        }
                      : undefined
                  }
                />
              ))}
        </MapView>
      );
    }

    // --- REACT NATIVE ---
    return (
      <MapView ref={mapRef} style={styles.map} initialRegion={defaultRegion}>
        {/* Usuarios */}
        {(viewMode === 'all' || viewMode === 'routes') &&
          userLocations.map(user => (
            <Marker
              key={`user-${user.id}`}
              coordinate={{
                latitude: user.latitude,
                longitude: user.longitude,
              }}
              title={user.name}
              description={`${user.isOnline ? 'Online' : 'Offline'} • ${
                user.speed?.toFixed(1) ?? 0
              } km/h`}
              pinColor={getUserMarkerColor(user)}
            />
          ))}

        {/* Login / Logout / Tracking */}
        {(viewMode === 'all' || viewMode === 'routes') && (
          <>
            {selectedUserRoute
              .filter(p => p.type === 'login' || p.type === 'logout')
              .map((p, i) => (
                <Marker
                  key={`event-${i}`}
                  coordinate={{
                    latitude: p.latitude,
                    longitude: p.longitude,
                  }}
                  title={p.type === 'login' ? 'Login' : 'Logout'}
                  pinColor={getTrackingMarkerColor(p.type)}
                />
              ))}

            {selectedUserRoute.filter(p => p.type === 'tracking').length > 0 && (
              <Polyline
                coordinates={selectedUserRoute
                  .filter(p => p.type === 'tracking')
                  .map(p => ({
                    latitude: p.latitude,
                    longitude: p.longitude,
                  }))}
                strokeColor="#000"
                strokeWidth={5}
              />
            )}
          </>
        )}

        {/* === FORMULARIOS === */}
        {(viewMode === 'forms' || viewMode === 'all') &&
          selectedUserRoute
            .filter(p => p.type === 'form_start')
            .map((p, i) => (
              <Marker
                key={`formstart-${i}`}
                coordinate={{
                  latitude: p.latitude,
                  longitude: p.longitude,
                }}
                title="Inicio de Formulario"
              >
                <View
                  style={{
                    backgroundColor: 'white',
                    padding: 4,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#007BFF',
                  }}
                >
                  <Ionicons name="clipboard-outline" size={20} color="#007BFF" />
                </View>
              </Marker>
            ))}
      </MapView>
    );
  };

  // === Conexión WebSocket ===
  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mapa de Tracking</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={refreshData}
              style={styles.headerButton}
              disabled={loading}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
            <View
              style={[
                styles.connectionIndicator,
                isConnected && styles.connected,
              ]}
            >
              <Ionicons
                name={isConnected ? 'wifi' : 'wifi-outline'}
                size={16}
                color="#fff"
              />
            </View>
          </View>
        </View>

        {/* Controles */}
        <View style={styles.viewControls}>
          {['all', 'routes', 'forms'].map(mode => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewButton,
                viewMode === mode && styles.viewButtonActive,
              ]}
              onPress={() => setViewMode(mode as any)}
            >
              <Text
                style={[
                  styles.viewButtonText,
                  viewMode === mode && styles.viewButtonTextActive,
                ]}
              >
                {mode === 'all'
                  ? 'Todo'
                  : mode === 'routes'
                  ? 'Rutas'
                  : 'Formularios'}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => openDatePicker()}
            style={styles.dateButton}
          >
            <Text style={{ color: '#2196F3' }}>
              {selectedDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mapa */}
        <View style={styles.mapContainer}>
          {loading && userLocations.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Cargando datos...</Text>
            </View>
          ) : (
            renderMap()
          )}
        </View>

        {/* Calendario */}
        {showDateModal && (
          <DateTimePicker
  value={selectedDate}
  mode="date"
  display="default"
  onChange={onDateConfirm}
  maximumDate={new Date()}
/>
        )}

        {/* Lista de usuarios */}
        <ScrollView
          style={styles.infoPanel}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshData} />
          }
        >
          <Text style={styles.infoPanelTitle}>
            Usuarios en línea ({userLocations.filter(u => u.isOnline).length})
          </Text>
          {userLocations.map(user => (
            <TouchableOpacity
              key={user.id}
              style={[
                styles.userItem,
                selectedUser === user.id && styles.userItemSelected,
              ]}
              onPress={() => openDatePicker(user.id)}
            >
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userStatus}>
                {user.isOnline ? 'Online' : 'Offline'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// === Estilos ===
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f0f0' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#2196F3',
  },
  backButton: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerButton: { padding: 4 },
  connectionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connected: { backgroundColor: '#4CAF50' },
  viewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  viewButtonActive: { backgroundColor: '#2196F3' },
  viewButtonText: { fontSize: 14, color: '#555' },
  viewButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  dateButton: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 6,
  },
  mapContainer: { flex: 1 },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ccc',
  },
  mapPlaceholderText: { fontSize: 16, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14, color: '#555' },
  infoPanel: { maxHeight: height * 0.3, backgroundColor: '#fff' },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
    backgroundColor: '#f9f9f9',
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userItemSelected: { backgroundColor: '#e3f2fd' },
  userName: { fontSize: 14 },
  userStatus: { fontSize: 12, color: '#555' },
});
