// --- MAPA MÓVIL OPTIMIZADO CON MARCADORES DE INICIO/FIN Y FORMULARIOS ---
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, ScrollView, Modal } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

// Detectar si estamos en Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
const isWeb = Platform.OS === 'web';

// Solo importar MapView si NO estamos en Expo Go NI en Web
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;

if (!isExpoGo && !isWeb) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    Callout = maps.Callout;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('react-native-maps no disponible');
  }
}

// --- Interfaces ---
interface LocationPoint {
  id?: number;
  latitude: number;
  longitude: number;
  type: 'login' | 'logout' | 'tracking' | 'form_start' | 'form_end' | 'break_start' | 'break_end' | string;
  user_id?: number;
  user_name?: string;
  timestamp?: string;
  session_id?: string;
  form_id?: number;
  form_type?: string;
  notes?: string;
  distance_from_previous?: number;
}

interface TrackingSession {
  session_id: string;
  user_id?: number;
  user_name?: string;
  start_time?: string;
  end_time?: string;
  tracking_date?: string;
  status?: 'active' | 'completed' | 'interrupted';
  points_count?: number;
  total_distance?: number;
  total_duration?: number;
  forms_completed?: number;
  locations: LocationPoint[];
}

interface AdminMapMobileOptimizedProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  trackings: TrackingSession[];
  selectedSession?: TrackingSession | null;
  onSessionSelect?: (session: TrackingSession) => void;
  showRouteAnimation?: boolean;
  highlightFormPoints?: boolean;
  showStartEndMarkers?: boolean;
}

const AdminMapMobileOptimized = ({
  region,
  trackings = [],
  selectedSession,
  onSessionSelect,
  showRouteAnimation = false,
  highlightFormPoints = true,
  showStartEndMarkers = true,
}: AdminMapMobileOptimizedProps) => {
  
  const [selectedMarker, setSelectedMarker] = useState<{location: LocationPoint, session: TrackingSession} | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Si no hay región, no renderizamos el mapa
  if (!region) {
    return null;
  }

  // Si estamos en Web, no renderizamos nada (se usa AdminMapWebOptimized)
  if (isWeb) {
    return null;
  }

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return 'N/A';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const getMarkerColor = (location: LocationPoint): string => {
    if (location.type === 'login') return 'green';
    if (location.type === 'logout') return 'red';
    if (location.form_id || location.type?.includes('form')) return 'orange';
    if (location.type?.includes('break')) return 'purple';
    return 'blue';
  };

  // Si estamos en Expo Go, mostrar interfaz informativa mejorada
  if (isExpoGo || !MapView) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.icon}>🗺️</Text>
          <Text style={styles.title}>Vista de Tracking</Text>
          <Text style={styles.subtitle}>
            Mapas nativos no disponibles en Expo Go
          </Text>
        </View>

        {region && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={24} color="#C62828" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Ubicación Central</Text>
                <Text style={styles.infoValue}>
                  {region.latitude.toFixed(6)}, {region.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {trackings.length > 0 && (
          <View style={styles.sessionsContainer}>
            <Text style={styles.sectionTitle}>
              📊 Sesiones Activas ({trackings.length})
            </Text>
            
            {trackings.map((session, idx) => (
              <View key={session.session_id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionUserInfo}>
                    <Ionicons name="person-circle" size={32} color="#C62828" />
                    <View>
                      <Text style={styles.sessionUserName}>
                        {session.user_name || 'Usuario'}
                      </Text>
                      <Text style={styles.sessionId}>
                        ID: {session.session_id.substring(0, 12)}...
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    session.status === 'active' ? styles.statusActive : styles.statusCompleted
                  ]}>
                    <Text style={styles.statusText}>
                      {session.status === 'active' ? '🟢 Activa' : '⚫ Finalizada'}
                    </Text>
                  </View>
                </View>

                <View style={styles.sessionStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="location" size={16} color="#2196F3" />
                    <Text style={styles.statText}>
                      {String(session.locations?.length || 0)} puntos
                    </Text>
                  </View>
                  
                  {(session.forms_completed ?? 0) > 0 && (
                    <View style={styles.statItem}>
                      <Ionicons name="document-text" size={16} color="#FF9800" />
                      <Text style={styles.statText}>
                        {String(session.forms_completed || 0)} formularios
                      </Text>
                    </View>
                  )}

                  {(session.total_distance ?? 0) > 0 && (
                    <View style={styles.statItem}>
                      <Ionicons name="navigate" size={16} color="#4CAF50" />
                      <Text style={styles.statText}>
                        {formatDistance(session.total_distance || 0)}
                      </Text>
                    </View>
                  )}
                </View>

                {session.locations && session.locations.length > 0 && (
                  <View style={styles.timeInfo}>
                    <View style={styles.timeRow}>
                      <Text style={styles.timeLabel}>🚀 Inicio:</Text>
                      <Text style={styles.timeValue}>
                        {formatTime(session.start_time || session.locations[0]?.timestamp || '')}
                      </Text>
                    </View>
                    {session.end_time && (
                      <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>🏁 Fin:</Text>
                        <Text style={styles.timeValue}>
                          {formatTime(session.end_time)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Mostrar puntos de formularios */}
                {session.locations && session.locations.filter(loc => loc.form_id).length > 0 && (
                  <View style={styles.formsSection}>
                    <Text style={styles.formsSectionTitle}>
                      📋 Formularios completados:
                    </Text>
                    {session.locations
                      .filter(loc => loc.form_id)
                      .map((loc, formIdx) => (
                        <View key={`form-${formIdx}`} style={styles.formItem}>
                          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                          <Text style={styles.formText}>
                            Formulario #{loc.form_id} - {formatTime(loc.timestamp)}
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={24} color="#2196F3" />
          <Text style={styles.noteText}>
            💡 Para ver el mapa interactivo con marcadores:{'\n'}
            • Usa la versión web (presiona 'w' en Expo Go){'\n'}
            • O compila una APK nativa con EAS Build
          </Text>
        </View>
      </ScrollView>
    );
  }

  // Código del mapa real para builds nativos - SIMPLIFICADO
  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton
        loadingEnabled
      >
        {trackings.map((session) => {
          const validLocations = (session.locations || []).filter(
            (loc) =>
              typeof loc.latitude === 'number' &&
              typeof loc.longitude === 'number' &&
              !isNaN(loc.latitude) &&
              !isNaN(loc.longitude) &&
              loc.latitude !== 0 &&
              loc.longitude !== 0
          );

          if (validLocations.length === 0) return null;

          // Color según estado de la sesión
          const routeColor = session.status === 'active' ? '#4CAF50' : '#2196F3';

          return (
            <React.Fragment key={session.session_id}>
              {/* ✅ LÍNEA DEL RECORRIDO - Siempre visible si hay más de 1 punto */}
              {validLocations.length > 1 && (
                <Polyline
                  coordinates={validLocations.map((loc) => ({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  }))}
                  strokeColor={routeColor}
                  strokeWidth={4}
                  geodesic
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {/* ✅ SOLO MARCADORES DE LOGIN Y LOGOUT */}
              {validLocations.map((loc, idx) => {
                const isLogin = loc.type === 'login' || idx === 0;
                const isLogout = loc.type === 'logout' || (idx === validLocations.length - 1 && session.status === 'completed');
                
                // Solo mostrar login y logout
                if (!isLogin && !isLogout) return null;

                return (
                  <Marker
                    key={`marker-${session.session_id}-${idx}`}
                    coordinate={{
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    }}
                    onPress={() => {
                      setSelectedMarker({ location: loc, session });
                      setShowDetailModal(true);
                    }}
                  >
                    <View style={[
                      styles.simpleMarker,
                      isLogin ? styles.markerLogin : styles.markerLogout
                    ]}>
                      <Ionicons 
                        name="location" 
                        size={24} 
                        color="#fff" 
                      />
                    </View>
                    <Callout>
                      <View style={styles.callout}>
                        <Text style={styles.calloutTitle}>
                          {session.user_name || 'Usuario'}
                        </Text>
                        <Text style={styles.calloutText}>
                          {isLogin ? '🟢 Login' : '🔴 Logout'} - {formatTime(loc.timestamp)}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Modal de detalles */}
      {selectedMarker && (
        <Modal
          visible={showDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedMarker.session.user_name || 'Usuario'}
                </Text>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Ionicons name="close" size={28} color="#757575" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tipo:</Text>
                  <Text style={styles.detailValue}>
                    {selectedMarker.location.type || 'tracking'}
                  </Text>
                </View>

                {selectedMarker.location.timestamp && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hora:</Text>
                    <Text style={styles.detailValue}>
                      {formatTime(selectedMarker.location.timestamp)}
                    </Text>
                  </View>
                )}

                {selectedMarker.location.form_id && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📋 Formulario:</Text>
                    <Text style={styles.detailValue}>
                      #{selectedMarker.location.form_id}
                      {selectedMarker.location.form_type && ` (${selectedMarker.location.form_type})`}
                    </Text>
                  </View>
                )}

                {selectedMarker.location.distance_from_previous && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distancia:</Text>
                    <Text style={styles.detailValue}>
                      {formatDistance(selectedMarker.location.distance_from_previous)}
                    </Text>
                  </View>
                )}

                {selectedMarker.location.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.detailLabel}>Nota:</Text>
                    <Text style={styles.notesText}>
                      {selectedMarker.location.notes}
                    </Text>
                  </View>
                )}

                <View style={styles.coordsContainer}>
                  <Text style={styles.coordsText}>
                    📍 {selectedMarker.location.latitude.toFixed(6)}, {selectedMarker.location.longitude.toFixed(6)}
                  </Text>
                  <Text style={styles.coordsText}>
                    🆔 {selectedMarker.session.session_id.substring(0, 12)}...
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#C62828',
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  sessionsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 16,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sessionUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sessionUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  sessionId: {
    fontSize: 11,
    color: '#757575',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
  },
  statusCompleted: {
    backgroundColor: '#E0E0E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#424242',
  },
  timeInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: '#757575',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
  },
  formsSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  formsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  formText: {
    fontSize: 13,
    color: '#424242',
  },
  noteCard: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 20,
  },
  // ✅ MARCADORES SIMPLES - Solo icono de ubicación
  simpleMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerLogin: {
    backgroundColor: '#4CAF50', // Verde para login
  },
  markerLogout: {
    backgroundColor: '#F44336', // Rojo para logout
  },
  callout: {
    padding: 8,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 12,
    color: '#424242',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#C62828',
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#212121',
  },
  notesContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  notesText: {
    fontSize: 13,
    color: '#424242',
    marginTop: 4,
  },
  coordsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  coordsText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
});

export default AdminMapMobileOptimized;
