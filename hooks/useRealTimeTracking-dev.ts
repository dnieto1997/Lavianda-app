import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

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

interface UseRealTimeTrackingReturn {
  userLocations: UserLocation[];
  sessionRoutes: SessionRoute[];
  formMarkers: FormMarker[];
  loading: boolean;
  isConnected: boolean;
  refreshData: () => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
}

// --- CONFIGURACIÓN ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

// Datos mock para desarrollo
const mockUserLocations: UserLocation[] = [
  {
    id: 1,
    name: "Juan Pérez",
    latitude: 4.60971,
    longitude: -74.08175,
    accuracy: 10.5,
    speed: 2.3,
    heading: 45.0,
    timestamp: new Date().toISOString(),
    isOnline: true,
    lastActivity: new Date().toISOString(),
  },
  {
    id: 2,
    name: "María García",
    latitude: 4.61171,
    longitude: -74.08375,
    accuracy: 8.2,
    speed: 0.0,
    heading: 0.0,
    timestamp: new Date(Date.now() - 300000).toISOString(),
    isOnline: true,
    lastActivity: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 3,
    name: "Carlos López",
    latitude: 4.60771,
    longitude: -74.07975,
    accuracy: 15.0,
    speed: 6.8,
    heading: 90.0,
    timestamp: new Date(Date.now() - 120000).toISOString(),
    isOnline: true,
    lastActivity: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 4,
    name: "Ana Rodríguez",
    latitude: 4.61371,
    longitude: -74.08575,
    accuracy: 5.0,
    speed: 0.0,
    heading: 0.0,
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    isOnline: false,
    lastActivity: new Date(Date.now() - 1800000).toISOString(),
  }
];

const mockSessionRoutes: SessionRoute[] = [
  {
    id: "session-1",
    userId: 1,
    userName: "Juan Pérez",
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: undefined,
    isActive: true,
    totalDistance: 5.2,
    points: [
      {
        latitude: 4.60871,
        longitude: -74.08075,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'login',
      },
      {
        latitude: 4.60921,
        longitude: -74.08125,
        timestamp: new Date(Date.now() - 3300000).toISOString(),
        type: 'tracking',
      },
      {
        latitude: 4.60971,
        longitude: -74.08175,
        timestamp: new Date().toISOString(),
        type: 'tracking',
      }
    ]
  },
  {
    id: "session-2",
    userId: 2,
    userName: "María García",
    startTime: new Date(Date.now() - 7200000).toISOString(),
    endTime: new Date(Date.now() - 3600000).toISOString(),
    isActive: false,
    totalDistance: 8.7,
    points: [
      {
        latitude: 4.61071,
        longitude: -74.08275,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        type: 'login',
      },
      {
        latitude: 4.61121,
        longitude: -74.08325,
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        type: 'tracking',
      },
      {
        latitude: 4.61171,
        longitude: -74.08375,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'logout',
      }
    ]
  }
];

const mockFormMarkers: FormMarker[] = [
  {
    id: 1,
    latitude: 4.60971,
    longitude: -74.08175,
    consecutivo: "FRM-2025-001",
    empresa: "Empresa ABC",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    userName: "Juan Pérez",
    type: 'form_start',
  },
  {
    id: 2,
    latitude: 4.61171,
    longitude: -74.08375,
    consecutivo: "FRM-2025-002",
    empresa: "Empresa XYZ",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userName: "María García",
    type: 'form_end',
  },
  {
    id: 3,
    latitude: 4.60771,
    longitude: -74.07975,
    consecutivo: "FRM-2025-003",
    empresa: "Empresa 123",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    userName: "Carlos López",
    type: 'form_start',
  }
];

export const useRealTimeTrackingDev = (): UseRealTimeTrackingReturn => {
  // --- ESTADOS ---
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [sessionRoutes, setSessionRoutes] = useState<SessionRoute[]>([]);
  const [formMarkers, setFormMarkers] = useState<FormMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // --- FUNCIONES DE API ---
  const fetchActiveUsers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No hay token, usando datos mock para desarrollo');
        setUserLocations(mockUserLocations);
        return;
      }

      console.log('🔍 Intentando obtener usuarios activos...');
      const response = await axios.get(`${API_BASE}/admin/active-users-locations`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        console.log('✅ Usuarios activos obtenidos exitosamente');
        setUserLocations(response.data.users || []);
      }
    } catch (error) {
      console.warn('⚠️ Error en API fetchActiveUsers:', error);
      setUserLocations(mockUserLocations);
    }
  }, []);

  const fetchSessionRoutes = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No hay token, usando rutas mock para desarrollo');
        setSessionRoutes(mockSessionRoutes);
        return;
      }

      console.log('🔍 Intentando obtener rutas de sesión...');
      const response = await axios.get(`${API_BASE}/admin/tracking/active-sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        console.log('✅ Rutas de sesión obtenidas exitosamente');
        setSessionRoutes(response.data.sessions || []);
      }
    } catch (error) {
      console.warn('⚠️ Error en API fetchSessionRoutes:', error);
      setSessionRoutes(mockSessionRoutes);
    }
  }, []);

  const fetchFormMarkers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No hay token, usando formularios mock para desarrollo');
        setFormMarkers(mockFormMarkers);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      console.log('🔍 Intentando obtener marcadores de formularios...');
      const response = await axios.get(`${API_BASE}/admin/forms-locations?date=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        console.log('✅ Marcadores de formularios obtenidos exitosamente');
        setFormMarkers(response.data.forms || []);
      }
    } catch (error) {
      console.warn('⚠️ Error en API fetchFormMarkers:', error);
      setFormMarkers(mockFormMarkers);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      // Usar Promise.allSettled para que no falle si uno de los endpoints tiene error
      const results = await Promise.allSettled([
        fetchActiveUsers(),
        fetchSessionRoutes(),
        fetchFormMarkers()
      ]);
      
      // Logs de resultados
      results.forEach((result, index) => {
        const endpoints = ['usuarios activos', 'rutas de sesión', 'formularios'];
        if (result.status === 'rejected') {
          console.warn(`⚠️ Error en ${endpoints[index]}:`, result.reason);
        } else {
          console.log(`✅ ${endpoints[index]} actualizados correctamente`);
        }
      });
      
      console.log('✅ Proceso de actualización completado');
    } finally {
      setLoading(false);
    }
  }, [fetchActiveUsers, fetchSessionRoutes, fetchFormMarkers]);

  // --- WEBSOCKET SIMULADO ---
  const connectWebSocket = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No hay token, WebSocket simulado para desarrollo');
        setIsConnected(true);
        return;
      }

      // Aquí iría la conexión real al WebSocket cuando haya token
      console.log('🔗 Conectando a WebSocket real...');
      setIsConnected(true);

    } catch (error) {
      console.error('❌ Error conectando WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  const disconnectWebSocket = useCallback(() => {
    console.log('📡 WebSocket desconectado');
    setIsConnected(false);
  }, []);

  // --- EFECTOS ---
  useEffect(() => {
    // Cargar datos iniciales
    refreshData();
    
    // Conectar WebSocket
    connectWebSocket();

    // Simular updates cada 10 segundos en desarrollo
    const interval = setInterval(() => {
      setUserLocations(prev => prev.map(user => ({
        ...user,
        latitude: user.latitude + (Math.random() - 0.5) * 0.001,
        longitude: user.longitude + (Math.random() - 0.5) * 0.001,
        speed: Math.random() * 10,
        timestamp: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      })));
    }, 10000);

    // Cleanup al desmontar
    return () => {
      clearInterval(interval);
      disconnectWebSocket();
    };
  }, []);

  // Simular reconexión si se pierde la conexión
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
    loading,
    isConnected,
    refreshData,
    connectWebSocket,
    disconnectWebSocket,
  };
};