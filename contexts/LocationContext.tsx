// --- START OF FILE contexts/LocationContext.tsx (Versión Final Corregida) ---

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import * as Location from 'expo-location';
import axios from 'axios';
import { Alert } from 'react-native';

// --- CONFIGURACIÓN ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

// --- DEFINICIÓN DE TIPOS ---
interface LocationContextType {
  startTracking: (token: string, type: 'login' | 'logout') => Promise<void>;
}

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
    
    console.log('📡 [LocationContext] Enviando ubicación al servidor (formato MySQL)...', locationData);

    try {
      const response = await axios.post(`${API_BASE}/locations`, locationData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log('✅ [LocationContext] Ubicación enviada exitosamente:', response.data);
    } catch (error) {
      console.error('❌ [LocationContext] Error CRÍTICO al enviar ubicación al servidor:');
      if (axios.isAxiosError(error)) {
        console.error('    -> Status:', error.response?.status);
        console.error('    -> Data (Error de Laravel):', JSON.stringify(error.response?.data, null, 2)); 
      } else {
        console.error('    -> Error no relacionado con Axios:', error);
      }
      throw error;
    }
  }, []);

  const startTracking = useCallback(async (token: string, type: 'login' | 'logout') => {
    console.log(`🗺️ [LocationContext] Iniciando el envío de punto de tipo: ${type}`);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('El permiso para acceder a la ubicación fue denegado.');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      // ✅✅ LA SOLUCIÓN ESTÁ AQUÍ ✅✅
      // Formateamos la fecha al formato 'YYYY-MM-DD HH:MM:SS' que MySQL entiende.
      const timestampForMySQL = new Date(location.timestamp)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        timestamp: timestampForMySQL, // Usamos la fecha formateada
        type: type,
        session_id: `${type}_${Date.now()}`
      };
      
      await sendLocationToServer(token, locationData);

    } catch (error: any) {
      console.error(`❌ [LocationContext] Falló el proceso de envío del punto de '${type}':`, error.message);
      Alert.alert(
          'Error de Ubicación',
          `No se pudo registrar la ubicación de ${type}. Error: ${error.message}`
      );
      throw error; 
    }
  }, [sendLocationToServer]);

  return (
    <LocationContext.Provider value={{ startTracking }}>
      {children}
    </LocationContext.Provider>
  );
};