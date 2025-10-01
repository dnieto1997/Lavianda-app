import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform, AppState, AppStateStatus } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const API_BASE = 'https://operaciones.lavianda.com.co/api';
const LOCATION_TASK_NAME = 'background-location-task';
const SESSION_STORAGE_KEY = 'active_tracking_session';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  altitude?: number;
  speed?: number;
  timestamp: number;
}

interface TrackingSession {
  sessionId: string;
  startedAt: string;
  isActive: boolean;
  totalPoints: number;
  lastLocation?: LocationData;
}

// Definir la tarea de fondo para el tracking
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }: any) => {
  if (error) {
    console.error('❌ Error en tarea de fondo:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    console.log('📍 Ubicación recibida en segundo plano:', locations);
    
    // Procesar ubicaciones en segundo plano
    locations.forEach(async (location: any) => {
      try {
        await processBackgroundLocation(location);
      } catch (err) {
        console.error('❌ Error procesando ubicación en segundo plano:', err);
      }
    });
  }
});

// Procesar ubicación capturada en segundo plano
async function processBackgroundLocation(location: any) {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    const sessionData = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    
    if (!token || !sessionData) {
      console.log('⚠️ No hay token o sesión activa para segundo plano');
      return;
    }

    const session = JSON.parse(sessionData);
    
    const locationData: LocationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
      heading: location.coords.heading,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      timestamp: location.timestamp
    };

    await sendLocationToServer(locationData, token, session.sessionId, true);
    
    // Actualizar datos de la sesión
    session.totalPoints += 1;
    session.lastLocation = locationData;
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    
  } catch (error) {
    console.error('❌ Error en processBackgroundLocation:', error);
  }
}

async function sendLocationToServer(
  locationData: LocationData, 
  token: string, 
  sessionId: string, 
  isBackground: boolean = false
) {
  try {
    console.log(`📍 Enviando ubicación al servidor (background: ${isBackground}):`, locationData);
    
    // Convertir timestamp a formato MySQL datetime
    const mysqlDateTime = new Date(locationData.timestamp)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    
    // Obtener información de la batería si está disponible
    let batteryLevel = null;
    try {
      // Esta funcionalidad requeriría una librería adicional como expo-battery
      // batteryLevel = await Battery.getBatteryLevelAsync() * 100;
    } catch (e) {
      // Ignorar si no está disponible
    }
    
    const payload = {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      accuracy: locationData.accuracy || 0,
      speed: locationData.speed,
      heading: locationData.heading,
      altitude: locationData.altitude,
      battery_level: batteryLevel,
      is_background: isBackground,
      timestamp: mysqlDateTime,
      type: 'tracking',
      session_id: sessionId
    };

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-App-Version': '1.0.0', // Agregar versión de la app
      'X-Platform': Platform.OS,
      'X-Device-Info': `${Platform.OS} ${Platform.Version}`
    };

    const response = await axios.post(`${API_BASE}/locations`, payload, { 
      headers,
      timeout: 10000 // 10 segundos timeout
    });
    
    console.log(`✅ Ubicación enviada exitosamente (background: ${isBackground}):`, response.data);
    
  } catch (error) {
    console.error('❌ Error al enviar ubicación:', error);
    
    // Guardar ubicación offline para enviar más tarde
    await saveOfflineLocation(locationData, sessionId, isBackground);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', error.response.data);
    }
  }
}

// Guardar ubicación offline para sincronizar más tarde
async function saveOfflineLocation(locationData: LocationData, sessionId: string, isBackground: boolean) {
  try {
    const offlineKey = 'offline_locations';
    const existingData = await AsyncStorage.getItem(offlineKey);
    const offlineLocations = existingData ? JSON.parse(existingData) : [];
    
    offlineLocations.push({
      ...locationData,
      sessionId,
      isBackground,
      savedAt: Date.now()
    });

    // Mantener solo las últimas 100 ubicaciones offline
    if (offlineLocations.length > 100) {
      offlineLocations.splice(0, offlineLocations.length - 100);
    }

    await AsyncStorage.setItem(offlineKey, JSON.stringify(offlineLocations));
    console.log('💾 Ubicación guardada offline');
    
  } catch (error) {
    console.error('❌ Error guardando ubicación offline:', error);
  }
}

// Sincronizar ubicaciones offline
async function syncOfflineLocations(token: string) {
  try {
    const offlineKey = 'offline_locations';
    const offlineData = await AsyncStorage.getItem(offlineKey);
    
    if (!offlineData) return;
    
    const offlineLocations = JSON.parse(offlineData);
    
    if (offlineLocations.length === 0) return;
    
    console.log(`🔄 Sincronizando ${offlineLocations.length} ubicaciones offline`);
    
    for (const location of offlineLocations) {
      try {
        await sendLocationToServer(
          location, 
          token, 
          location.sessionId, 
          location.isBackground
        );
      } catch (error) {
        console.error('❌ Error sincronizando ubicación offline:', error);
        break; // Parar si hay error para no perder el orden
      }
    }
    
    // Limpiar ubicaciones sincronizadas
    await AsyncStorage.removeItem(offlineKey);
    console.log('✅ Ubicaciones offline sincronizadas');
    
  } catch (error) {
    console.error('❌ Error en sincronización offline:', error);
  }
}

export const useLocationTracking = (token: string | null, isActive: boolean = false) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingSession, setTrackingSession] = useState<TrackingSession | null>(null);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);
  const appState = useRef(AppState.currentState);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Manejar cambios en el estado de la aplicación
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`🔄 App state cambió de ${appState.current} a ${nextAppState}`);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 App volvió a primer plano');
      // Sincronizar ubicaciones offline cuando vuelva a primer plano
      if (token) {
        syncOfflineLocations(token);
      }
    }
    
    appState.current = nextAppState;
  };

  // Inicializar o restaurar sesión activa
  useEffect(() => {
    if (token && isActive) {
      restoreActiveSession();
    }
  }, [token, isActive]);

  // Restaurar sesión activa desde AsyncStorage
  const restoreActiveSession = async () => {
    try {
      const sessionData = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        setTrackingSession(session);
        console.log('🔄 Sesión de tracking restaurada:', session.sessionId);
      }
    } catch (error) {
      console.error('❌ Error restaurando sesión:', error);
    }
  };

  // Iniciar nueva sesión de tracking
  const startNewTrackingSession = async (initialLocation?: LocationData) => {
    if (!token) return null;

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session: TrackingSession = {
        sessionId,
        startedAt: new Date().toISOString(),
        isActive: true,
        totalPoints: 0
      };

      // Guardar sesión en AsyncStorage
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      await AsyncStorage.setItem('auth_token', token);
      
      setTrackingSession(session);

      // Enviar punto de login si hay ubicación inicial
      if (initialLocation) {
        await sendLocationToServer(initialLocation, token, sessionId, false);
        session.totalPoints = 1;
        session.lastLocation = initialLocation;
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }

      console.log('✅ Nueva sesión de tracking iniciada:', sessionId);
      return session;
      
    } catch (error) {
      console.error('❌ Error iniciando sesión de tracking:', error);
      return null;
    }
  };

  // Finalizar sesión de tracking
  const endTrackingSession = async (finalLocation?: LocationData) => {
    if (!trackingSession || !token) return;

    try {
      // Enviar punto de logout si hay ubicación final
      if (finalLocation) {
        const logoutPayload = {
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude,
          accuracy: finalLocation.accuracy || 0,
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          type: 'logout',
          session_id: trackingSession.sessionId
        };

        await axios.post(`${API_BASE}/locations`, logoutPayload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      }

      // Limpiar sesión
      await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
      setTrackingSession(null);
      
      // Detener tracking en segundo plano
      await stopBackgroundTracking();
      
      console.log('✅ Sesión de tracking finalizada');
      
    } catch (error) {
      console.error('❌ Error finalizando sesión:', error);
    }
  };

  // Iniciar tracking en segundo plano
  const startBackgroundTracking = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permisos de ubicación en segundo plano denegados');
        return false;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced, // Balancear precisión y batería
        timeInterval: 60000, // Cada 60 segundos en segundo plano
        distanceInterval: 20, // Cada 20 metros
        foregroundService: {
          notificationTitle: 'Seguimiento activo',
          notificationBody: 'La Vianda está rastreando tu ubicación',
          notificationColor: '#C62828'
        }
      });

      setIsBackgroundActive(true);
      console.log('✅ Tracking en segundo plano iniciado');
      return true;
      
    } catch (error) {
      console.error('❌ Error iniciando tracking en segundo plano:', error);
      setError('Error al iniciar seguimiento en segundo plano');
      return false;
    }
  };

  // Detener tracking en segundo plano
  const stopBackgroundTracking = async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('✅ Tracking en segundo plano detenido');
      }
      
      setIsBackgroundActive(false);
      
    } catch (error) {
      console.error('❌ Error deteniendo tracking en segundo plano:', error);
    }
  };

  // Tracking principal
  useEffect(() => {
    const startTracking = async () => {
      if (!isActive || !token || !trackingSession) return;

      try {
        // Pedir permisos de primer plano
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permisos de ubicación denegados');
          return;
        }

        console.log('📍 Iniciando seguimiento GPS...');

        // Iniciar tracking en segundo plano
        await startBackgroundTracking();

        // Configurar el seguimiento de primer plano
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 30000, // Cada 30 segundos en primer plano
            distanceInterval: 10, // Cada 10 metros
          },
          (newLocation) => {
            const locationData: LocationData = {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy || 0,
              heading: newLocation.coords.heading || undefined,
              altitude: newLocation.coords.altitude || undefined,
              speed: newLocation.coords.speed || undefined,
              timestamp: newLocation.timestamp
            };

            setLocation(locationData);
            
            // Solo enviar si no estamos en segundo plano para evitar duplicados
            if (appState.current === 'active') {
              sendLocationToServer(locationData, token, trackingSession.sessionId, false);
            }
          }
        );

        console.log('✅ Seguimiento GPS iniciado');
      } catch (err) {
        console.error('❌ Error al iniciar seguimiento:', err);
        setError('Error al iniciar el seguimiento de ubicación');
      }
    };

    startTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        console.log('📍 Seguimiento GPS de primer plano detenido');
      }
    };
  }, [isActive, token, trackingSession]);

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (!trackingSession?.isActive) {
        stopBackgroundTracking();
      }
    };
  }, []);

  // Función para enviar puntos de formularios
  const sendFormLocationPoint = async (formId: number, type: 'start' | 'end', notes?: string) => {
    if (!trackingSession || !token || !location) {
      console.warn('⚠️ No se puede enviar punto de formulario: falta sesión, token o ubicación');
      return;
    }

    try {
      const pointType = type === 'start' ? 'form_start' : 'form_end';
      
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0,
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        type: pointType,
        session_id: trackingSession.sessionId,
        form_id: formId,
        notes: notes || `Formulario ${formId} - ${type === 'start' ? 'inicio' : 'fin'}`
      };

      const response = await axios.post(`${API_BASE}/locations`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`✅ Punto de formulario enviado (${type}):`, response.data);
      
    } catch (error) {
      console.error('❌ Error enviando punto de formulario:', error);
      throw error;
    }
  };

  return { 
    location, 
    error, 
    trackingSession,
    isBackgroundActive,
    startNewTrackingSession,
    endTrackingSession,
    sendFormLocationPoint,
    syncOfflineLocations: () => token ? syncOfflineLocations(token) : Promise.resolve()
  };
};
