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
import { useRealTimeTracking } from '../hooks/useRealTimeTracking';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;

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
  } = useRealTimeTracking();

  const [viewMode, setViewMode] = useState<'all' | 'routes' | 'forms'>('all');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const mapRef = useRef<any>(null);

  // Colores de markers
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
      case 'tracking':
      default:
        return '#2196F3';
    }
  };
  

  const getFormMarkerColor = (form: any) =>
    form.type === 'form_start' ? '#4CAF50' : '#FF9800';

  // Abrir calendario solo desde lista o botón de fecha
  const openDatePicker = (userId?: number) => {
    if (userId) setSelectedUser(userId);
    setShowDateModal(true);
  };


  const onDateConfirm = async (event: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDateModal(false);
    if (!date) return;

    setSelectedDate(date);

    if (selectedUser) {
      const formattedDate = date.toISOString().split('T')[0];
      try {
        await fetchUserLocationsByDate(selectedUser, formattedDate);

        // Centrar mapa en primer punto
        if (mapRef.current && selectedUserRoute.length > 0) {
          const firstPoint = selectedUserRoute[0];
          if (Platform.OS === 'web') {
            mapRef.current.panTo({ lat: firstPoint.latitude, lng: firstPoint.longitude });
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
        console.error('Error al obtener rutas del usuario:', error);
      }
    }
  };

  const renderMap = () => {
    if (!MapView) {
      return (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Mapa no disponible en esta plataforma</Text>
        </View>
      );
    }

    if (Platform.OS === 'web') {
      return (
        <MapView
          ref={mapRef}
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: defaultRegion.latitude, lng: defaultRegion.longitude }}
          zoom={12}
        >
          {(viewMode === 'all' || viewMode === 'routes') &&
            userLocations.map(user => (
              <Marker
                key={`user-${user.id}`}
                position={{ lat: user.latitude, lng: user.longitude }}
                title={`${user.name} (${user.isOnline ? 'Online' : 'Offline'})`}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: getUserMarkerColor(user),
                  fillOpacity: 0.8,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                }}
              />
            ))}

          {(viewMode === 'all' || viewMode === 'routes') &&
            selectedUserRoute.length > 0 &&
            selectedUserRoute.map((p, index) => {
              if (p.type === 'tracking') return null;
              return (
                <Marker
                  key={`event-${index}`}
                  position={{ lat: p.latitude, lng: p.longitude }}
                  title={p.type === 'login' ? 'Login' : 'Logout'}
                  icon={{
                    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: getTrackingMarkerColor(p.type),
                    fillOpacity: 0.9,
                    strokeColor: '#fff',
                    strokeWeight: 1,
                  }}
                />
              );
            })}

          {(viewMode === 'all' || viewMode === 'routes') &&
            selectedUserRoute.filter(p => p.type === 'tracking').length > 0 && (
              <Polyline
                path={selectedUserRoute
                  .filter(p => p.type === 'tracking')
                  .map(p => ({ lat: p.latitude, lng: p.longitude }))}
                options={{ strokeColor: '#000000ff', strokeOpacity: 0.8, strokeWeight: 4 }}
              />
            )}

          {(viewMode === 'all' || viewMode === 'forms') &&
            formMarkers.map(form => (
              <Marker
                key={`form-${form.id}`}
                position={{ lat: form.latitude, lng: form.longitude }}
                title={`${form.consecutivo} - ${form.empresa}`}
                icon={{
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 6,
                  fillColor: getFormMarkerColor(form),
                  fillOpacity: 0.9,
                  strokeColor: '#fff',
                  strokeWeight: 1,
                }}
              />
            ))}
        </MapView>
      );
    }

    return (
      <MapView ref={mapRef} style={styles.map} initialRegion={defaultRegion}>
        {(viewMode === 'all' || viewMode === 'routes') &&
          userLocations.map(user => (
            <Marker
              key={`user-${user.id}`}
              coordinate={{ latitude: user.latitude, longitude: user.longitude }}
              title={user.name}
              description={`${user.isOnline ? 'Online' : 'Offline'} • ${
                user.speed?.toFixed(1) ?? 0
              } km/h`}
              pinColor={getUserMarkerColor(user)}
            />
          ))}

        {(viewMode === 'all' || viewMode === 'routes') &&
          selectedUserRoute.map((p, index) => {
            if (p.type === 'tracking') return null;
            return (
              <Marker
                key={`event-${index}`}
                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                title={p.type === 'login' ? 'Login' : 'Logout'}
                description={p.type === 'login' ? 'Ingreso' : 'Salida'}
                pinColor={getTrackingMarkerColor(p.type)}
              />
            );
          })}

        {(viewMode === 'all' || viewMode === 'routes') &&
          selectedUserRoute.filter(p => p.type === 'tracking').length > 0 && (
            <Polyline
              coordinates={selectedUserRoute
                .filter(p => p.type === 'tracking')
                .map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
              strokeColor="#000"
              strokeWidth={5}
              lineCap="round"
            />
          )}

        {(viewMode === 'all' || viewMode === 'forms') &&
          formMarkers.map(form => (
            <Marker
              key={`form-${form.id}`}
              coordinate={{ latitude: form.latitude, longitude: form.longitude }}
              title={form.consecutivo}
              description={`${form.empresa} • ${form.userName ?? ''}`}
              pinColor={getFormMarkerColor(form)}
            />
          ))}
      </MapView>
    );
  };

  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mapa de Tracking</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={refreshData} style={styles.headerButton} disabled={loading}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.connectionIndicator, isConnected && styles.connected]}>
            <Ionicons name={isConnected ? 'wifi' : 'wifi-outline'} size={16} color="#fff" />
          </View>
        </View>
      </View>

      {/* Controles */}
      <View style={styles.viewControls}>
        {['all', 'routes', 'forms'].map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewButton, viewMode === mode && styles.viewButtonActive]}
            onPress={() => setViewMode(mode as 'all' | 'routes' | 'forms')}
          >
            <Text
              style={[
                styles.viewButtonText,
                viewMode === mode && styles.viewButtonTextActive,
              ]}
            >
              {mode === 'all' ? 'Todo' : mode === 'routes' ? 'Rutas' : 'Formularios'}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Botón de fecha */}
        <TouchableOpacity onPress={() => openDatePicker()} style={styles.dateButton}>
          <Text style={{ color: '#2196F3' }}>{selectedDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        {loading && userLocations.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Cargando datos de tracking...</Text>
          </View>
        ) : (
          renderMap()
        )}
      </View>

      {/* Modal fecha */}
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshData} />}
      >
        <Text style={styles.infoPanelTitle}>
          Usuarios en línea ({userLocations.filter(u => u.isOnline).length})
        </Text>
        {userLocations.map(user => (
          <TouchableOpacity
            key={user.id}
            style={[styles.userItem, selectedUser === user.id && styles.userItemSelected]}
            onPress={() => openDatePicker(user.id)}
          >
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userStatus}>{user.isOnline ? 'Online' : 'Offline'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f0f0' },
  container: { flex: 1, backgroundColor: '#f0f0f0' },
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
  viewButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#eee' },
  viewButtonActive: { backgroundColor: '#2196F3' },
  viewButtonText: { fontSize: 14, color: '#555' },
  viewButtonTextActive: { color: '#fff', fontWeight: 'bold' },
  dateButton: { padding: 6, borderWidth: 1, borderColor: '#2196F3', borderRadius: 6 },
  mapContainer: { flex: 1, backgroundColor: '#e0e0e0' },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ccc' },
  mapPlaceholderText: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14, color: '#555' },
  infoPanel: { maxHeight: height * 0.3, backgroundColor: '#fff' },
  infoPanelTitle: { fontSize: 16, fontWeight: 'bold', padding: 8, backgroundColor: '#f9f9f9' },
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
