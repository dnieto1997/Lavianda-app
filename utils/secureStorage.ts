/**
 * 🔐 Secure Storage Utility - MULTIPLATAFORMA
 * 
 * Sistema híbrido que usa SecureStore con fallback a AsyncStorage en móvil
 * y localStorage en web para garantizar compatibilidad total.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Importación condicional para móvil
let SecureStore: any = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch (error) {
    console.warn('⚠️ expo-secure-store no disponible');
  }
}

const USE_ASYNC_STORAGE_FALLBACK = true; // Activar fallback en caso de error

/**
 * Guardar valor de forma segura - Multiplataforma
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // En web usar localStorage
      localStorage.setItem(key, value);
      console.log(`✅ [SecureStorage] Guardado en localStorage: ${key}`);
      return;
    }

    if (SecureStore) {
      // Intentar SecureStore primero (más seguro en móvil)
      await SecureStore.setItemAsync(key, value);
      console.log(`✅ [SecureStorage] Guardado en SecureStore: ${key}`);
      
      // También guardar en AsyncStorage como backup
      if (USE_ASYNC_STORAGE_FALLBACK) {
        await AsyncStorage.setItem(`backup_${key}`, value);
        console.log(`✅ [SecureStorage] Backup en AsyncStorage: backup_${key}`);
      }
    } else {
      // Fallback directo a AsyncStorage si SecureStore no está disponible
      await AsyncStorage.setItem(key, value);
      console.log(`✅ [SecureStorage] Guardado en AsyncStorage: ${key}`);
    }
  } catch (error) {
    console.error(`❌ [SecureStorage] Error en storage principal para ${key}:`, error);
    
    // Fallback a AsyncStorage en móvil
    if (Platform.OS !== 'web') {
      try {
        await AsyncStorage.setItem(key, value);
        console.log(`✅ [SecureStorage] Guardado en AsyncStorage (fallback): ${key}`);
      } catch (asyncError) {
        console.error(`❌ [SecureStorage] Error en AsyncStorage para ${key}:`, asyncError);
        throw new Error(`No se pudo guardar ${key} en ningún storage`);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Obtener valor de forma segura - Multiplataforma
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // En web usar localStorage
      const value = localStorage.getItem(key);
      console.log(`📖 [SecureStorage] Leído de localStorage: ${key} = ${value ? '***' : 'null'}`);
      return value;
    }

    if (SecureStore) {
      // Intentar SecureStore primero en móvil
      const value = await SecureStore.getItemAsync(key);
      
      if (value) {
        console.log(`✅ [SecureStorage] Encontrado en SecureStore: ${key}`);
        return value;
      }
      
      console.log(`⚠️ [SecureStorage] No encontrado en SecureStore: ${key}, intentando backup...`);
      
      // Si no está en SecureStore, buscar en AsyncStorage backup
      if (USE_ASYNC_STORAGE_FALLBACK) {
        const backupValue = await AsyncStorage.getItem(`backup_${key}`);
        if (backupValue) {
          console.log(`✅ [SecureStorage] Encontrado en AsyncStorage backup: backup_${key}`);
          
          // Restaurar a SecureStore
          try {
            await SecureStore.setItemAsync(key, backupValue);
            console.log(`♻️ [SecureStorage] Restaurado a SecureStore: ${key}`);
          } catch (restoreError) {
            console.warn(`⚠️ [SecureStorage] No se pudo restaurar a SecureStore`);
          }
          
          return backupValue;
        }
      }
      
      // Último intento: buscar directamente en AsyncStorage
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        console.log(`✅ [SecureStorage] Encontrado en AsyncStorage: ${key}`);
        return asyncValue;
      }
    } else {
      // Fallback directo a AsyncStorage si SecureStore no está disponible
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        console.log(`✅ [SecureStorage] Encontrado en AsyncStorage: ${key}`);
        return asyncValue;
      }
    }
    
    console.log(`❌ [SecureStorage] No encontrado en ningún storage: ${key}`);
    return null;
    
  } catch (error) {
    console.error(`❌ [SecureStorage] Error obteniendo ${key}:`, error);
    
    if (Platform.OS !== 'web') {
      // Último recurso: AsyncStorage en móvil
      try {
        const asyncValue = await AsyncStorage.getItem(key);
        if (asyncValue) {
          console.log(`✅ [SecureStorage] Encontrado en AsyncStorage (fallback): ${key}`);
          return asyncValue;
        }
      } catch (asyncError) {
        console.error(`❌ [SecureStorage] Error en AsyncStorage:`, asyncError);
      }
    }
    
    return null;
  }
}

/**
 * Eliminar valor de forma segura - Multiplataforma
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // En web eliminar de localStorage
      localStorage.removeItem(key);
      console.log(`🗑️ [SecureStorage] Eliminado de localStorage: ${key}`);
      return;
    }

    if (SecureStore) {
      // Eliminar de SecureStore en móvil
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`🗑️ [SecureStorage] Eliminado de SecureStore: ${key}`);
      } catch (error) {
        console.warn(`⚠️ [SecureStorage] Error eliminando de SecureStore: ${key}`);
      }
    }
    
    // Eliminar de AsyncStorage backup
    try {
      await AsyncStorage.removeItem(`backup_${key}`);
      await AsyncStorage.removeItem(key);
      console.log(`🗑️ [SecureStorage] Eliminado de AsyncStorage: ${key}`);
    } catch (error) {
      console.warn(`⚠️ [SecureStorage] Error eliminando de AsyncStorage: ${key}`);
    }
  } catch (error) {
    console.error(`❌ [SecureStorage] Error eliminando ${key}:`, error);
  }
}

/**
 * Verificar si existe un valor - Multiplataforma
 */
export async function hasSecureItem(key: string): Promise<boolean> {
  const value = await getSecureItem(key);
  return value !== null;
}

/**
 * Obtener información de debug sobre el storage - Multiplataforma
 */
export async function getStorageDebugInfo(key: string): Promise<{
  inSecureStore: boolean;
  inAsyncStorage: boolean;
  inBackup: boolean;
  inLocalStorage: boolean;
  valueLength: number;
}> {
  let inSecureStore = false;
  let inAsyncStorage = false;
  let inBackup = false;
  let inLocalStorage = false;
  let valueLength = 0;
  
  if (Platform.OS === 'web') {
    try {
      const localValue = localStorage.getItem(key);
      if (localValue) {
        inLocalStorage = true;
        valueLength = localValue.length;
      }
    } catch (e) {
      console.warn(`Debug: Error checking localStorage for ${key}`);
    }
  } else {
    if (SecureStore) {
      try {
        const secureValue = await SecureStore.getItemAsync(key);
        if (secureValue) {
          inSecureStore = true;
          valueLength = secureValue.length;
        }
      } catch (e) {
        console.warn(`Debug: Error checking SecureStore for ${key}`);
      }
    }
    
    try {
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        inAsyncStorage = true;
        if (!valueLength) valueLength = asyncValue.length;
      }
    } catch (e) {
      console.warn(`Debug: Error checking AsyncStorage for ${key}`);
    }
    
    try {
      const backupValue = await AsyncStorage.getItem(`backup_${key}`);
      if (backupValue) {
        inBackup = true;
        if (!valueLength) valueLength = backupValue.length;
      }
    } catch (e) {
      console.warn(`Debug: Error checking backup for ${key}`);
    }
  }
  
  return { inSecureStore, inAsyncStorage, inBackup, inLocalStorage, valueLength };
}
