import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getEcho } from '../services/echo';

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

export type LocationType =
  | 'login'
  | 'tracking'
  | 'logout'
  | 'form_start'
  | 'form_end';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  type: LocationType;
  formId?: number | null;
}

interface SessionRoute {
  id: string; // se mantiene string ya que sessionId es string
  userId: number;
  userName: string;
  startTime: string;
  endTime?: string;
  points: LocationPoint[];
  isActive: boolean;
  totalDistance: number;
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

interface TrackingDataResponse {
  success: boolean;
  data: LocationPoint[];
  total?: number;
}

interface UseRealTimeTrackingReturn {
  userLocations: UserLocation[];
  sessionRoutes: SessionRoute[];
  formMarkers: FormMarker[];
  selectedUserRoute: LocationPoint[];
  loading: boolean;
  isConnected: boolean;
  refreshData: () => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  fetchUserLocationsByDate: (userId: number,date:any) => Promise<void>;
  fetchFormMarkers: (userId: number,date:any) => Promise<void>;
}

// --- CONFIGURACIÓN ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

export const useRealTimeTracking = (): UseRealTimeTrackingReturn => {
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [sessionRoutes, setSessionRoutes] = useState<SessionRoute[]>([]);
  const [formMarkers, setFormMarkers] = useState<FormMarker[]>([]);
  const [selectedUserRoute, setSelectedUserRoute] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // --- API ---
  const fetchActiveUsers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE}/admin/active-users-locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.success) {
        setUserLocations(response.data.users || []);
      }
    } catch (error) {
      console.error('❌ Error al obtener usuarios activos:', error);
    }
  }, []);

  const fetchSessionRoutes = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await axios.get(`${API_BASE}/admin/tracking/active-sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.success) {
        setSessionRoutes(response.data.sessions || []);
      }
    } catch (error) {
      console.error('❌ Error al obtener rutas activas:', error);
    }
  }, []);

  const fetchFormMarkers = useCallback(async (userId: number,date:any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

     
      const response = await axios.get(`${API_BASE}/admin/forms-locations?user_id=${userId}&date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.success) {
        setFormMarkers(response.data.forms || []);
      }
    } catch (error) {
      console.error('❌ Error al obtener formularios:', error);
    }
  }, []);

  const fetchUserLocationsByDate = useCallback(async (userId: number,date:any) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('No auth token');

      
      const response = await axios.get<TrackingDataResponse>(
        `${API_BASE}/locations?user_id=${userId}&date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data?.success) {
        const points: LocationPoint[] = response.data.data.map(item => ({
          latitude: item.latitude,
          longitude: item.longitude,
          timestamp: item.timestamp,
          type: item.type,
          formId: item.formId ?? null,
        }));

        setSelectedUserRoute(points);
      } else {
        setSelectedUserRoute([]);
      }
    } catch (error) {
      console.error('❌ Error al obtener ubicaciones por usuario:', error);
      setSelectedUserRoute([]);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActiveUsers(),
        fetchSessionRoutes(),
     
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveUsers, fetchSessionRoutes]);

  // --- WEBSOCKET ---
  const connectWebSocket = useCallback(async () => {
    try {
      const echo = await getEcho();
      if (!echo) return;

      console.log('🔗 Conectando a WebSocket en tiempo real...');

      const trackingChannel = echo.channel('tracking');
      trackingChannel.listen('.location.updated', (data: any) => {
        setUserLocations(prev => {
          const existing = prev.find(u => u.id === data.userId);
          const updated: UserLocation = {
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
          return existing
            ? prev.map(u => (u.id === data.userId ? updated : u))
            : [...prev, updated];
        });
      });

      const operacionesChannel = echo.channel('operaciones');
      operacionesChannel.listen('.formulario.creado', (data: any) => {
        if (data.latitude && data.longitude) {
          setFormMarkers(prev => [
            ...prev,
            {
              id: data.id,
              latitude: data.latitude,
              longitude: data.longitude,
              consecutivo: data.consecutivo,
              empresa: data.empresa,
              timestamp: data.created_at,
              userName: data.user_name,
              type: 'form_start',
            },
          ]);
        }
      });

      operacionesChannel.listen('.formulario.actualizado', (data: any) => {
        if (data.latitude && data.longitude) {
          setFormMarkers(prev =>
            prev.map(marker =>
              marker.id === data.id
                ? { ...marker, type: 'form_end' }
                : marker
            )
          );
        }
      });

      const asistenciasChannel = echo.channel('asistencias');
      asistenciasChannel.listen('.asistencia.marcada', () => {
        refreshData();
      });

      setIsConnected(true);
    } catch (error) {
      console.error('❌ Error conectando WebSocket:', error);
      setIsConnected(false);
    }
  }, [refreshData]);

  const disconnectWebSocket = useCallback(async () => {
    try {
      const echo = await getEcho();
      if (echo) {
        echo.leave('tracking');
        echo.leave('operaciones');
        echo.leave('asistencias');
        console.log('📡 WebSocket desconectado');
      }
      setIsConnected(false);
    } catch (error) {
      console.error('❌ Error desconectando WebSocket:', error);
    }
  }, []);

  // --- EFECTOS ---
  useEffect(() => {
    (async () => {
      await refreshData();
      await connectWebSocket();
    })();

    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket, refreshData]);

  useEffect(() => {
    if (!isConnected) {
      const timer = setTimeout(() => {
        console.log('🔄 Intentando reconectar WebSocket...');
        connectWebSocket();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectWebSocket]);

  return {
    userLocations,
    sessionRoutes,
    formMarkers,
    selectedUserRoute,
    loading,
    isConnected,
    refreshData,
    connectWebSocket,
    disconnectWebSocket,
    fetchUserLocationsByDate,
    fetchFormMarkers
    
  };
};
