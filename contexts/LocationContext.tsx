// --- START OF FILE contexts/LocationContext.tsx (VERSIÓN PRODUCCIÓN) ---

import React, { createContext, useContext, useCallback, useEffect, ReactNode } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- CONFIGURACIÓN ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';
const LOCATION_TASK_NAME = 'background-location-task';

// --- DEFINICIÓN DE TIPOS ---
interface LocationContextType {
  startTracking: (token: string, type: 'login' | 'logout') => Promise<void>;
  startBackgroundTracking: (token: string, sessionId: string) => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
  isTrackingActive: () => Promise<boolean>;
}

// --- STORAGE KEYS ---
const STORAGE_KEYS = {
  TOKEN: 'tracking_token',
  SESSION_ID: 'tracking_session_id',
  IS_TRACKING: 'is_tracking_active',
};

// --- BACKGROUND TASK DEFINITION ---
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ [BackgroundTask] Error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    
    try {
      // Obtener token y session_id desde AsyncStorage
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const sessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID);
      
      if (!token || !sessionId) {
        console.warn('⚠️ [BackgroundTask] No hay token o session_id');
        return;
      }

      // Procesar cada ubicación
      for (const location of locations) {
        const timestampForMySQL = new Date(location.timestamp)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');

        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed || 0,
          heading: location.coords.heading || 0,
          altitude: location.coords.altitude || 0,
          timestamp: timestampForMySQL,
          type: 'tracking',
          session_id: sessionId,
        };

        // Enviar al servidor
        await axios.post(`${API_BASE}/locations`, locationData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });

        console.log('📍 [BackgroundTask] Ubicación enviada en background');
      }
    } catch (error) {
      console.error('❌ [BackgroundTask] Error enviando ubicación:', error);
    }
  }
});

// --- CREACIÓN DEL CONTEXTO ---
const LocationContext = createContext<LocationContextType | null>(null);

// --- HOOK PERSONALIZADO ---
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation debe usarse dentro de un LocationProvider');
  }
  return context;
};

// --- COMPONENTE PROVIDER ---
export const LocationProvider = ({ children }: { children: ReactNode }) => {

  const sendLocationToServer = useCallback(async (token: string, locationData: any) => {
    if (!token) {
      throw new Error('No se proporcionó token para la autenticación.');
    }
    
    console.log('📡 [LocationContext] Enviando ubicación al servidor...', locationData.type);

    try {
      const response = await axios.post(`${API_BASE}/locations`, locationData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log('✅ [LocationContext] Ubicación enviada exitosamente');
      return response.data;
    } catch (error) {
      console.error('❌ [LocationContext] Error al enviar ubicación:', error);
      throw error;
    }
  }, []);

  // Enviar punto único (login/logout)
  const startTracking = useCallback(async (token: string, type: 'login' | 'logout') => {
    console.log(`🗺️ [LocationContext] Enviando punto de tipo: ${type}`);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('El permiso para acceder a la ubicación fue denegado.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const timestampForMySQL = new Date(location.timestamp)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        altitude: location.coords.altitude || 0,
        timestamp: timestampForMySQL,
        type: type,
        session_id: `${type}_${Date.now()}`
      };
      
      await sendLocationToServer(token, locationData);

    } catch (error: any) {
      console.error(`❌ [LocationContext] Error enviando punto de '${type}':`, error.message);
      Alert.alert(
        'Error de Ubicación',
        `No se pudo registrar la ubicación de ${type}. Error: ${error.message}`
      );
      throw error; 
    }
  }, [sendLocationToServer]);

  // Iniciar tracking en background (PRODUCCIÓN)
  const startBackgroundTracking = useCallback(async (token: string, sessionId: string) => {
    console.log('🎯 [LocationContext] Iniciando tracking en background REAL...');
    
    try {
      // Guardar token y sessionId en AsyncStorage para el background task
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      await AsyncStorage.setItem(STORAGE_KEYS.IS_TRACKING, 'true');

      // Solicitar permisos de ubicación en background
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('Permiso de ubicación en primer plano denegado');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('⚠️ Permiso de ubicación en background denegado. El tracking solo funcionará con la app abierta.');
      }

      // Verificar si ya hay una tarea registrada
      const isTaskDefined = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskDefined) {
        console.log('⚠️ Deteniendo tarea anterior...');
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Iniciar tracking en background
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Cada 30 segundos
        distanceInterval: 50, // O cada 50 metros
        foregroundService: {
          notificationTitle: 'La Vianda - Tracking Activo',
          notificationBody: 'Registrando tu ubicación',
          notificationColor: '#C62828',
        },
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });

      console.log('✅ [LocationContext] Tracking en background iniciado');
      console.log('📍 Se enviará ubicación cada 30 segundos o cada 50 metros');

    } catch (error: any) {
      console.error('❌ [LocationContext] Error iniciando tracking en background:', error);
      Alert.alert(
        'Error de Tracking',
        `No se pudo iniciar el tracking: ${error.message}`
      );
      throw error;
    }
  }, []);

  // Detener tracking en background
  const stopBackgroundTracking = useCallback(async () => {
    console.log('🛑 [LocationContext] Deteniendo tracking en background...');
    
    try {
      const isTaskDefined = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskDefined) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      // Limpiar AsyncStorage
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.SESSION_ID);
      await AsyncStorage.removeItem(STORAGE_KEYS.IS_TRACKING);

      console.log('✅ [LocationContext] Tracking en background detenido');
    } catch (error) {
      console.error('❌ [LocationContext] Error deteniendo tracking:', error);
    }
  }, []);

  // Verificar si el tracking está activo
  const isTrackingActive = useCallback(async (): Promise<boolean> => {
    const isTracking = await AsyncStorage.getItem(STORAGE_KEYS.IS_TRACKING);
    return isTracking === 'true';
  }, []);

  return (
    <LocationContext.Provider value={{ 
      startTracking, 
      startBackgroundTracking,
      stopBackgroundTracking,
      isTrackingActive
    }}>
      {children}
    </LocationContext.Provider>
  );
};