import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapViewHandle from 'react-native-maps'
import { GoogleMap, Marker as GoogleMarker, Polyline as GooglePolyline } from '@react-google-maps/api';
import axios from 'axios';

// Servicios de WebSocket
import echoService, { getEcho } from '../services/echo';

// --- TIPOS ---
interface UserLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  isOnline: boolean;
  lastActivity: string;
}

interface SessionRoute {
  id: string;
  userId: number;
  userName: string;
  startTime: string;
  endTime?: string;
  points: LocationPoint[];
  isActive: boolean;
  totalDistance: number;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  type: 'login' | 'tracking' | 'logout' | 'form_start' | 'form_end';
  formId?: number;
}

interface FormMarker {
  id: number;
  latitude: number;
  longitude: number;
  consecutivo: string;
  empresa: string;
  timestamp: string;
  userName: string;
  type: 'form_start' | 'form_end';
}

// --- CONFIGURACIÓN ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';
const { width, height } = Dimensions.get('window');

// Configuración del mapa web
const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: false,
};

const center = { lat: 4.60971, lng: -74.08175 }; // Bogotá por defecto

export default function AdminMapOptimized() {
  // --- ESTADOS ---
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [sessionRoutes, setSessionRoutes] = useState<SessionRoute[]>([]);
  const [formMarkers, setFormMarkers] = useState<FormMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'routes' | 'forms'>('all');

  // Referencias
  const mapRef = useRef<MapViewHandle | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);

  // --- FUNCIONES DE API ---
  const fetchActiveUsers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await axios.get(`${API_BASE}/admin/active-users-locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });

  console.log('Fetched active users:', response);

      if (response.data.success) {
            
        setUserLocations(response.data.users);
      }
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  }, []);

  const fetchSessionRoutes = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE}/admin/tracking/active-sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSessionRoutes(response.data.sessions);
      }
    } catch (error) {
      console.error('Error fetching session routes:', error);
    }
  }, []);

  const fetchFormMarkers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${API_BASE}/admin/forms-locations?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setFormMarkers(response.data.forms);
      }
    } catch (error) {
      console.error('Error fetching form markers:', error);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchActiveUsers(),
      fetchSessionRoutes(),
      fetchFormMarkers()
    ]);
    setLoading(false);
  }, [fetchActiveUsers, fetchSessionRoutes, fetchFormMarkers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  // --- WEBSOCKET HANDLERS ---
  const setupWebSocketListeners = useCallback(async () => {
    try {
      const echo = await getEcho();
      if (!echo) {
        console.warn('⚠️ No se pudo inicializar WebSocket');
        return;
      }

      console.log('🔗 Configurando listeners de WebSocket...');

      // Canal de tracking en tiempo real
      const trackingChannel = echo.channel('tracking');
      
      trackingChannel.listen('.location.updated', (data: any) => {
        console.log('📍 Ubicación actualizada:', data);
        
        setUserLocations(prev => {
          const existing = prev.find(user => user.id === data.userId);
          const updatedUser: UserLocation = {
            id: data.userId,
            name: data.userName,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
            timestamp: data.timestamp,
            isOnline: true,
            lastActivity: data.timestamp,
          };

          if (existing) {
            return prev.map(user => 
              user.id === data.userId ? updatedUser : user
            );
          } else {
            return [...prev, updatedUser];
          }
        });
      });

      // Canal de formularios
      const operacionesChannel = echo.channel('operaciones');
      
      operacionesChannel.listen('.formulario.creado', (data: any) => {
        console.log('📋 Formulario creado:', data);
        
        if (data.latitude && data.longitude) {
          const newMarker: FormMarker = {
            id: data.id,
            latitude: data.latitude,
            longitude: data.longitude,
            consecutivo: data.consecutivo,
            empresa: data.empresa,
            timestamp: data.created_at,
            userName: data.user_name,
            type: 'form_start',
          };
          
          setFormMarkers(prev => [...prev, newMarker]);
        }
      });

      operacionesChannel.listen('.formulario.actualizado', (data: any) => {
        console.log('📋 Formulario actualizado:', data);
        // Actualizar marcador existente si es necesario
      });

      setIsConnected(true);

      // Cleanup
      return () => {
        echo.leave('tracking');
        echo.leave('operaciones');
      };
    } catch (error) {
      console.error('❌ Error configurando WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  // --- EFECTOS ---
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const setupAndCleanup = async () => {
      const cleanup = await setupWebSocketListeners();
      return cleanup;
    };
    
    setupAndCleanup().then(cleanup => {
      return cleanup;
    });
  }, [setupWebSocketListeners]);

  // --- FUNCIONES DE MAPA ---
  const centerMapOnUser = useCallback((userId: number) => {
    const user = userLocations.find(u => u.id === userId);
    if (!user) return;

    if (Platform.OS === 'web' && googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: user.latitude,
        lng: user.longitude
      });
      googleMapRef.current.setZoom(16);
    } else if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: user.latitude,
        longitude: user.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }

    setSelectedUser(userId);
  }, [userLocations]);

  const fitAllMarkers = useCallback(() => {
    if (userLocations.length === 0) return;

    if (Platform.OS === 'web' && googleMapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      userLocations.forEach(user => {
        bounds.extend({ lat: user.latitude, lng: user.longitude });
      });
      googleMapRef.current.fitBounds(bounds);
    } else if (mapRef.current) {
      const coordinates = userLocations.map(user => ({
        latitude: user.latitude,
        longitude: user.longitude,
      }));
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [userLocations]);

  // --- RENDERIZACIÓN DE MARCADORES ---
  const getUserMarkerColor = (user: UserLocation) => {
    if (!user.isOnline) return '#808080'; // Gris para offline
    if (user.speed && user.speed > 5) return '#ff4444'; // Rojo para movimiento rápido
    if (user.speed && user.speed > 1) return '#ffaa00'; // Naranja para movimiento
    return '#44ff44'; // Verde para estático
  };

  const getFormMarkerColor = (form: FormMarker) => {
    return form.type === 'form_start' ? '#4CAF50' : '#FF9800';
  };

  // --- RENDERIZADO ---
  if (loading && userLocations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando mapa de tracking...</Text>
      </View>
    );
  }

  return (
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
            onPress={onRefresh}
            style={[styles.headerButton, refreshing && styles.headerButtonDisabled]}
            disabled={refreshing}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          
          <View style={[styles.connectionIndicator, isConnected && styles.connected]}>
            <Ionicons 
              name={isConnected ? "wifi" : "wifi-outline"} 
              size={16} 
              color="#fff" 
            />
          </View>
        </View>
      </View>

      {/* Controles de vista */}
      <View style={styles.viewControls}>
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'all' && styles.viewButtonActive]}
          onPress={() => setViewMode('all')}
        >
          <Text style={[styles.viewButtonText, viewMode === 'all' && styles.viewButtonTextActive]}>
            Todo
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'routes' && styles.viewButtonActive]}
          onPress={() => setViewMode('routes')}
        >
          <Text style={[styles.viewButtonText, viewMode === 'routes' && styles.viewButtonTextActive]}>
            Rutas
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewButton, viewMode === 'forms' && styles.viewButtonActive]}
          onPress={() => setViewMode('forms')}
        >
          <Text style={[styles.viewButtonText, viewMode === 'forms' && styles.viewButtonTextActive]}>
            Formularios
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={12}
            options={mapOptions}
            onLoad={(map) => {
              googleMapRef.current = map;
              setMapReady(true);
            }}
          >
            {/* Marcadores de usuarios */}
            {(viewMode === 'all' || viewMode === 'routes') && userLocations.map(user => (
              <GoogleMarker
                key={`user-${user.id}`}
                position={{ lat: user.latitude, lng: user.longitude }}
                title={`${user.name} (${user.isOnline ? 'Online' : 'Offline'})`}
                onClick={() => centerMapOnUser(user.id)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: getUserMarkerColor(user),
                  fillOpacity: 0.8,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
              />
            ))}

            {/* Rutas de sesión */}
            {(viewMode === 'all' || viewMode === 'routes') && sessionRoutes.map(session => (
              <GooglePolyline
                key={`route-${session.id}`}
                path={session.points.map(point => ({ lat: point.latitude, lng: point.longitude }))}
                options={{
                  strokeColor: session.isActive ? '#2196F3' : '#9E9E9E',
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                }}
              />
            ))}

            {/* Marcadores de formularios */}
            {(viewMode === 'all' || viewMode === 'forms') && formMarkers.map(form => (
              <GoogleMarker
                key={`form-${form.id}`}
                position={{ lat: form.latitude, lng: form.longitude }}
                title={`${form.consecutivo} - ${form.empresa}`}
                icon={{
                  path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                  scale: 6,
                  fillColor: getFormMarkerColor(form),
                  fillOpacity: 0.9,
                  strokeColor: '#ffffff',
                  strokeWeight: 1,
                }}
              />
            ))}
          </GoogleMap>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 4.60971,
              longitude: -74.08175,
              latitudeDelta: 0.1,
              longitudeDelta: 0.1,
            }}
            onMapReady={() => setMapReady(true)}
          >
            {/* Marcadores de usuarios */}
            {(viewMode === 'all' || viewMode === 'routes') && userLocations.map(user => (
              <Marker
                key={`user-${user.id}`}
                coordinate={{ latitude: user.latitude, longitude: user.longitude }}
                title={user.name}
                description={`${user.isOnline ? 'Online' : 'Offline'} - ${user.lastActivity}`}
                pinColor={getUserMarkerColor(user)}
                onPress={() => centerMapOnUser(user.id)}
              />
            ))}

            {/* Rutas de sesión */}
            {(viewMode === 'all' || viewMode === 'routes') && sessionRoutes.map(session => (
              <Polyline
                key={`route-${session.id}`}
                coordinates={session.points.map(point => ({ 
                  latitude: point.latitude, 
                  longitude: point.longitude 
                }))}
                strokeColor={session.isActive ? '#2196F3' : '#9E9E9E'}
                strokeWidth={3}
               
              />
            ))}

            {/* Marcadores de formularios */}
            {(viewMode === 'all' || viewMode === 'forms') && formMarkers.map(form => (
              <Marker
                key={`form-${form.id}`}
                coordinate={{ latitude: form.latitude, longitude: form.longitude }}
                title={form.consecutivo}
                description={`${form.empresa} - ${form.userName}`}
                pinColor={getFormMarkerColor(form)}
              >
                <View style={[styles.customMarker, { backgroundColor: getFormMarkerColor(form) }]}>
                  <Ionicons name="document-text" size={16} color="#fff" />
                </View>
              </Marker>
            ))}
          </MapView>
        )}
      </View>

      {/* Panel de información */}
      <ScrollView 
        style={styles.infoPanel}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.infoPanelTitle}>Usuarios Activos ({userLocations.length})</Text>
        
        {userLocations.map(user => (
          <TouchableOpacity
            key={user.id}
            style={[
              styles.userItem,
              selectedUser === user.id && styles.userItemSelected
            ]}
            onPress={() => centerMapOnUser(user.id)}
          >
            <View style={styles.userInfo}>
              <View style={[styles.statusDot, { backgroundColor: getUserMarkerColor(user) }]} />
              <Text style={styles.userName}>{user.name}</Text>
            </View>
            <Text style={styles.userDetails}>
              {user.isOnline ? 'Online' : 'Offline'} • {user.speed?.toFixed(1) || '0'} km/h
            </Text>
          </TouchableOpacity>
        ))}

        {formMarkers.length > 0 && (
          <>
            <Text style={styles.infoPanelTitle}>Formularios Hoy ({formMarkers.length})</Text>
            {formMarkers.slice(0, 5).map(form => (
              <View key={form.id} style={styles.formItem}>
                <Text style={styles.formConsecutivo}>{form.consecutivo}</Text>
                <Text style={styles.formEmpresa}>{form.empresa}</Text>
                <Text style={styles.formUser}>{form.userName}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Botón de ajustar vista */}
      {mapReady && (
        <TouchableOpacity
          style={styles.fitButton}
          onPress={fitAllMarkers}
        >
          <Ionicons name="resize" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 12,
    padding: 4,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  connectionIndicator: {
    marginLeft: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  connected: {
    backgroundColor: 'rgba(76,175,80,0.8)',
  },
  viewControls: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  viewButtonActive: {
    backgroundColor: '#2196F3',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  viewButtonTextActive: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoPanel: {
    maxHeight: height * 0.3,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 16,
    paddingBottom: 8,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userDetails: {
    fontSize: 14,
    color: '#666',
    marginLeft: 20,
  },
  formItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  formConsecutivo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  formEmpresa: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  formUser: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  fitButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});