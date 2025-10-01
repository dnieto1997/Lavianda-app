// --- START OF FILE app/(tabs)/admin-map.tsx (Versión Mejorada con Tracking Avanzado) ---

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useAuth } from '../_layout';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

// --- Interfaces ---
interface LocationPoint { 
  latitude: number; 
  longitude: number; 
  type: string; 
  user_id?: number; 
  user_name?: string; 
  timestamp?: string; 
  session_id?: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery_level?: number;
  is_background?: boolean;
  form_id?: number;
  notes?: string;
  distance_from_previous?: number;
}

interface TrackingSession { 
  session_id: string; 
  user_id: number; 
  user_name: string; 
  start_time: string; 
  end_time?: string; 
  points_count: number; 
  total_distance?: number;
  total_duration?: number;
  forms_completed?: number;
  breaks_taken?: number;
  status: 'active' | 'completed' | 'interrupted';
  tracking_date: string;
  locations: LocationPoint[]; 
}

interface AdminMapProps { 
  region: any; 
  trackings: TrackingSession[];
  selectedSession?: TrackingSession | null;
  onSessionSelect?: (session: TrackingSession | null) => void;
  showRouteAnimation?: boolean;
  highlightFormPoints?: boolean;
}

// Importar el componente de mapa correcto según la plataforma
let AdminMapComponent: React.ComponentType<AdminMapProps>;
if (Platform.OS === 'web') { 
  AdminMapComponent = require('../../components/AdminMapWeb').default; 
} else { 
  AdminMapComponent = require('../../components/native-only/AdminMapMobile').default; 
}

const COLORS = { 
  primary: '#C62828',
  secondary: '#1976D2',
  success: '#388E3C',
  warning: '#F57C00',
  error: '#D32F2F',
  info: '#0288D1'
};

export default function AdminMapScreen() {
  const { user } = useAuth();
  const [region, setRegion] = useState<any>(null);
  const [allSessions, setAllSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<TrackingSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'single' | 'comparison'>('all');
  const [showRouteAnimation, setShowRouteAnimation] = useState(false);
  const [highlightFormPoints, setHighlightFormPoints] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);

  const fetchUserSessions = useCallback(async () => {
    if (!user?.token) {
      console.log("🗺️ Mapa: No hay token, no se cargarán ubicaciones.");
      return;
    }

    console.log("🗺️ Mapa: Iniciando petición de sesiones...");
    setError(null);
    
    try {
      console.log("🌐 Mapa: Haciendo petición a API...");
      
      // Usar el nuevo endpoint de sesiones
      const response = await axios.get('https://operaciones.lavianda.com.co/api/locations/admin/sessions', {
        headers: { Authorization: `Bearer ${user.token}` },
        params: {
          date: selectedDate,
          user_id: selectedUserId || undefined,
          include_locations: true
        },
        timeout: 15000,
      });

      console.log("📡 Mapa: Respuesta recibida:", response.status);
      console.log("📊 Mapa: Datos:", response.data);

      if (!response.data.success) {
        console.log("❌ Mapa: Error en respuesta:", response.data.message);
        throw new Error(response.data.message);
      }

      const rawSessions = response.data.data || [];
      console.log("📍 Mapa: Sesiones crudas recibidas:", rawSessions.length);
      
      // Procesar sesiones con sus ubicaciones
      const processedSessions: TrackingSession[] = rawSessions.map((session: any) => {
        return {
          session_id: session.session_id,
          user_id: session.user_id,
          user_name: session.user_name || `Usuario ${session.user_id}`,
          start_time: session.start_time,
          end_time: session.end_time,
          points_count: session.points_count || 0,
          total_distance: session.total_distance || 0,
          total_duration: session.total_duration || 0,
          forms_completed: session.forms_completed || 0,
          breaks_taken: session.breaks_taken || 0,
          status: session.status || 'completed',
          tracking_date: session.tracking_date || selectedDate,
          locations: session.locations || []
        };
      });

      console.log("📊 Mapa: Sesiones procesadas:", processedSessions.length);
      setAllSessions(processedSessions);

      // Establecer región inicial si hay datos
      if (processedSessions.length > 0 && isFirstLoad.current) {
        const firstLocation = processedSessions[0].locations?.[0];
        if (firstLocation) {
          console.log("📍 Mapa: Estableciendo región inicial");
          setRegion({ 
            latitude: firstLocation.latitude, 
            longitude: firstLocation.longitude, 
            latitudeDelta: 0.02, 
            longitudeDelta: 0.02 
          });
          isFirstLoad.current = false;
        }
      }

      console.log("✅ Mapa: Carga de sesiones completada exitosamente");

    } catch (error) {
      console.error('❌ Error en fetchUserSessions:', error);
      if (axios.isAxiosError(error)) {
        console.log("🔍 Detalles del error:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        if (error.response?.status === 401) {
          setError("Tu sesión ha expirado. Por favor, inicia sesión de nuevo.");
        } else {
          setError(`Error ${error.response?.status}: ${error.response?.data?.message || 'No se pudieron cargar las sesiones.'}`);
        }
      } else {
        setError('Error de conexión. No se pudieron cargar las sesiones.');
      }
    } finally {
      console.log("🏁 Mapa: Finalizando fetchUserSessions, setting loading = false");
      setLoading(false);
    }
  }, [user?.token, selectedDate, selectedUserId]);

  // Manejar actualización automática
  useFocusEffect(
    useCallback(() => {
      console.log('🗺️ Mapa: Pantalla en foco. Iniciando carga y polling.');
      setLoading(true);
      fetchUserSessions();

      // Solo hacer polling si estamos viendo datos en tiempo real (fecha actual)
      const isToday = selectedDate === new Date().toISOString().split('T')[0];
      
      if (isToday) {
        const intervalId = setInterval(() => {
          console.log('🔄 Refrescando sesiones (polling)...');
          fetchUserSessions();
        }, 30000); // Cada 30 segundos para datos en tiempo real

        setRefreshInterval(intervalId);
      }

      return () => {
        console.log('🗺️ Mapa: Pantalla fuera de foco. Deteniendo polling.');
        if (refreshInterval) {
          clearInterval(refreshInterval);
          setRefreshInterval(null);
        }
      };
    }, [fetchUserSessions])
  );

  // Actualizar cuando cambie la fecha o usuario seleccionado
  useEffect(() => {
    setLoading(true);
    fetchUserSessions();
  }, [selectedDate, selectedUserId]);

  // Lógica de filtrado
  const uniqueUsers = Array.from(
    new Map(allSessions.map(t => [t.user_id, t])).values()
  ).map(t => ({ 
    user_id: t.user_id, 
    user_name: t.user_name, 
    total_sessions: allSessions.filter(s => s.user_id === t.user_id).length,
    total_distance: allSessions.filter(s => s.user_id === t.user_id).reduce((sum, s) => sum + (s.total_distance || 0), 0)
  }));

  const filteredUsers = uniqueUsers.filter(u => 
    u.user_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sessionsToShow = selectedUserId ? 
    allSessions.filter(t => t.user_id === selectedUserId) : 
    allSessions;

  const handleSessionSelect = (session: TrackingSession) => {
    setSelectedSession(selectedSession?.session_id === session.session_id ? null : session);
    setViewMode('single');
  };

  const handleExportSession = async (session: TrackingSession) => {
    try {
      const response = await axios.get(
        `https://operaciones.lavianda.com.co/api/tracking/sessions/${session.session_id}/export`,
        {
          headers: { Authorization: `Bearer ${user?.token}` },
          params: { format: 'gpx' },
          responseType: 'blob'
        }
      );

      // Manejar descarga del archivo GPX
      const blob = new Blob([response.data], { type: 'application/gpx+xml' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recorrido_${session.session_id}.gpx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Alert.alert('Éxito', 'Archivo GPX descargado correctamente');
    } catch (error) {
      console.error('Error exportando sesión:', error);
      Alert.alert('Error', 'No se pudo exportar la sesión');
    }
  };

  if (loading) {
    return (
      <View style={styles.fullScreenLoader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando mapa y recorridos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Panel de control mejorado */}
      <View style={styles.controlPanel}>
        <View style={styles.controlHeader}>
          <Text style={styles.controlTitle}>Control de Recorridos</Text>
          <TouchableOpacity 
            style={styles.filtersButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Filtros expandibles */}
        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.dateSelector}>
              <Text style={styles.filterLabel}>Fecha:</Text>
              <TextInput
                style={styles.dateInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
              />
            </View>

            <View style={styles.viewModeSelector}>
              <Text style={styles.filterLabel}>Vista:</Text>
              <View style={styles.viewModeButtons}>
                {['all', 'single', 'comparison'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.viewModeButton,
                      viewMode === mode && styles.viewModeButtonActive
                    ]}
                    onPress={() => setViewMode(mode as any)}
                  >
                    <Text style={[
                      styles.viewModeButtonText,
                      viewMode === mode && styles.viewModeButtonTextActive
                    ]}>
                      {mode === 'all' ? 'Todos' : mode === 'single' ? 'Individual' : 'Comparar'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.togglesContainer}>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setShowRouteAnimation(!showRouteAnimation)}
              >
                <Ionicons 
                  name={showRouteAnimation ? "play" : "play-outline"} 
                  size={16} 
                  color={showRouteAnimation ? COLORS.success : COLORS.primary} 
                />
                <Text style={styles.toggleText}>Animación</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setHighlightFormPoints(!highlightFormPoints)}
              >
                <Ionicons 
                  name={highlightFormPoints ? "document" : "document-outline"} 
                  size={16} 
                  color={highlightFormPoints ? COLORS.warning : COLORS.primary} 
                />
                <Text style={styles.toggleText}>Formularios</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.searchAndRefresh}>
          <TextInput 
            style={styles.searchInput} 
            placeholder="Buscar usuario..." 
            value={searchTerm} 
            onChangeText={setSearchTerm} 
          />
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={() => { 
              setLoading(true); 
              fetchUserSessions(); 
            }}
          >
            <Ionicons name="refresh" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Selector de usuarios mejorado */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.userSelector}>
          <TouchableOpacity 
            style={[styles.userButton, !selectedUserId && styles.userButtonActive]} 
            onPress={() => setSelectedUserId(null)}
          >
            <Text style={[styles.userButtonText, !selectedUserId && styles.userButtonTextActive]}>
              Todos
            </Text>
            <Text style={[styles.userStatsText, !selectedUserId && styles.userStatsTextActive]}>
              {allSessions.length} sesiones
            </Text>
          </TouchableOpacity>

          {filteredUsers.map((userInfo) => (
            <TouchableOpacity 
              key={userInfo.user_id} 
              style={[styles.userButton, selectedUserId === userInfo.user_id && styles.userButtonActive]} 
              onPress={() => setSelectedUserId(userInfo.user_id)}
            >
              <Text style={[styles.userButtonText, selectedUserId === userInfo.user_id && styles.userButtonTextActive]}>
                {userInfo.user_name}
              </Text>
              <Text style={[styles.userStatsText, selectedUserId === userInfo.user_id && styles.userStatsTextActive]}>
                {userInfo.total_sessions} sesiones • {(userInfo.total_distance / 1000).toFixed(1)}km
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista de sesiones */}
        {viewMode === 'single' && sessionsToShow.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionSelector}>
            {sessionsToShow.map((session) => (
              <TouchableOpacity
                key={session.session_id}
                style={[
                  styles.sessionButton,
                  selectedSession?.session_id === session.session_id && styles.sessionButtonActive
                ]}
                onPress={() => handleSessionSelect(session)}
                onLongPress={() => handleExportSession(session)}
              >
                <Text style={[
                  styles.sessionButtonText,
                  selectedSession?.session_id === session.session_id && styles.sessionButtonTextActive
                ]}>
                  {new Date(session.start_time).toLocaleTimeString()}
                </Text>
                <Text style={[
                  styles.sessionStatsText,
                  selectedSession?.session_id === session.session_id && styles.sessionStatsTextActive
                ]}>
                  {(session.total_distance || 0) > 1000 
                    ? `${((session.total_distance || 0) / 1000).toFixed(1)}km` 
                    : `${Math.round(session.total_distance || 0)}m`
                  } • {session.points_count} puntos
                </Text>
                <View style={[
                  styles.sessionStatusIndicator,
                  { backgroundColor: session.status === 'active' ? COLORS.success : session.status === 'completed' ? COLORS.info : COLORS.warning }
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Mensaje de error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Estadísticas rápidas */}
      {sessionsToShow.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{sessionsToShow.length}</Text>
            <Text style={styles.statLabel}>Sesiones</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {(sessionsToShow.reduce((sum, s) => sum + (s.total_distance || 0), 0) / 1000).toFixed(1)}km
            </Text>
            <Text style={styles.statLabel}>Distancia</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {sessionsToShow.reduce((sum, s) => sum + (s.forms_completed || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Formularios</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {sessionsToShow.filter(s => s.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
        </View>
      )}

      {/* Componente del mapa mejorado */}
      <AdminMapComponent 
        region={region} 
        trackings={viewMode === 'single' && selectedSession ? [selectedSession] : sessionsToShow}
        selectedSession={selectedSession}
        onSessionSelect={handleSessionSelect}
        showRouteAnimation={showRouteAnimation}
        highlightFormPoints={highlightFormPoints}
      />
    </View>
  );
}

// Estilos mejorados
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  fullScreenLoader: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f0f8ff' 
  },
  loadingText: { 
    marginTop: 10, 
    color: COLORS.primary, 
    fontWeight: '500' 
  },
  controlPanel: { 
    position: 'absolute', 
    top: 40, 
    left: 10, 
    right: 10, 
    zIndex: 10, 
    backgroundColor: 'rgba(255, 255, 255, 0.98)', 
    borderRadius: 12, 
    padding: 12, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 5, 
    elevation: 5,
    maxHeight: '70%' // Prevenir overflow
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  filtersButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0'
  },
  filtersContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 10,
    minWidth: 60
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 14
  },
  viewModeSelector: {
    marginBottom: 10
  },
  viewModeButtons: {
    flexDirection: 'row',
    marginTop: 5
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.primary
  },
  viewModeButtonText: {
    fontSize: 12,
    color: COLORS.primary
  },
  viewModeButtonTextActive: {
    color: '#fff'
  },
  togglesContainer: {
    flexDirection: 'row'
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 10,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  toggleText: {
    fontSize: 12,
    marginLeft: 4,
    color: COLORS.primary
  },
  searchAndRefresh: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  searchInput: { 
    flex: 1, 
    backgroundColor: '#f5f5f5', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    fontSize: 14 
  },
  refreshButton: { 
    marginLeft: 10, 
    padding: 8, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 8 
  },
  userSelector: { 
    flexDirection: 'row',
    marginBottom: 10
  },
  userButton: { 
    backgroundColor: '#f5f5f5', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginRight: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    minWidth: 120, 
    alignItems: 'center' 
  },
  userButtonActive: { 
    backgroundColor: COLORS.primary, 
    borderColor: COLORS.primary 
  },
  userButtonText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#666' 
  },
  userButtonTextActive: { 
    color: '#fff' 
  },
  userStatsText: { 
    fontSize: 10, 
    color: '#999', 
    marginTop: 2 
  },
  userStatsTextActive: { 
    color: '#ffffff' 
  },
  sessionSelector: {
    flexDirection: 'row',
    marginBottom: 10
  },
  sessionButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.info,
    minWidth: 100,
    alignItems: 'center',
    position: 'relative'
  },
  sessionButtonActive: {
    backgroundColor: COLORS.info,
    borderColor: COLORS.info
  },
  sessionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.info
  },
  sessionButtonTextActive: {
    color: '#fff'
  },
  sessionStatsText: {
    fontSize: 9,
    color: COLORS.info,
    marginTop: 2
  },
  sessionStatsTextActive: {
    color: '#ffffff'
  },
  sessionStatusIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-around',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },
  statItem: {
    alignItems: 'center'
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2
  },
  errorContainer: { 
    position: 'absolute', 
    bottom: 100, 
    left: 20, 
    right: 20, 
    backgroundColor: '#ffebee', 
    padding: 10, 
    borderRadius: 8, 
    zIndex: 10 
  },
  errorText: { 
    color: '#c62828', 
    textAlign: 'center', 
    fontWeight: '500' 
  },
  // Estilos para las estadísticas heredados
  userPointsText: { 
    fontSize: 10, 
    color: '#999', 
    marginTop: 2 
  },
  userPointsTextActive: { 
    color: '#ffffff' 
  },
});

// --- END OF FILE ---