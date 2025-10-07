/**
 * 🔐 Secure Storage Utility
 * 
 * Sistema híbrido que usa SecureStore con fallback a AsyncStorage
 * para garantizar que el token siempre se guarde correctamente.
 * 
 * PROBLEMA: SecureStore en Android (Expo Go) no funciona bien con tokens JWT grandes
 * SOLUCIÓN: Intentar SecureStore primero, si falla usar AsyncStorage
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const USE_ASYNC_STORAGE_FALLBACK = true; // Activar fallback en caso de error

/**
 * Guardar valor de forma segura
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    // Intentar SecureStore primero (más seguro)
    await SecureStore.setItemAsync(key, value);
    console.log(`✅ [SecureStorage] Guardado en SecureStore: ${key}`);
    
    // También guardar en AsyncStorage como backup
    if (USE_ASYNC_STORAGE_FALLBACK) {
      await AsyncStorage.setItem(`backup_${key}`, value);
      console.log(`✅ [SecureStorage] Backup en AsyncStorage: backup_${key}`);
    }
  } catch (error) {
    console.error(`❌ [SecureStorage] Error en SecureStore para ${key}:`, error);
    
    // Fallback a AsyncStorage
    try {
      await AsyncStorage.setItem(key, value);
      console.log(`✅ [SecureStorage] Guardado en AsyncStorage (fallback): ${key}`);
    } catch (asyncError) {
      console.error(`❌ [SecureStorage] Error en AsyncStorage para ${key}:`, asyncError);
      throw new Error(`No se pudo guardar ${key} en ningún storage`);
    }
  }
}

/**
 * Obtener valor de forma segura
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    // Intentar SecureStore primero
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
    
    console.log(`❌ [SecureStorage] No encontrado en ningún storage: ${key}`);
    return null;
    
  } catch (error) {
    console.error(`❌ [SecureStorage] Error obteniendo ${key}:`, error);
    
    // Último recurso: AsyncStorage
    try {
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue) {
        console.log(`✅ [SecureStorage] Encontrado en AsyncStorage (fallback): ${key}`);
        return asyncValue;
      }
    } catch (asyncError) {
      console.error(`❌ [SecureStorage] Error en AsyncStorage:`, asyncError);
    }
    
    return null;
  }
}

/**
 * Eliminar valor de forma segura
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    // Eliminar de SecureStore
    await SecureStore.deleteItemAsync(key);
    console.log(`🗑️ [SecureStorage] Eliminado de SecureStore: ${key}`);
  } catch (error) {
    console.warn(`⚠️ [SecureStorage] Error eliminando de SecureStore: ${key}`);
  }
  
  try {
    // Eliminar de AsyncStorage backup
    await AsyncStorage.removeItem(`backup_${key}`);
    await AsyncStorage.removeItem(key);
    console.log(`🗑️ [SecureStorage] Eliminado de AsyncStorage: ${key}`);
  } catch (error) {
    console.warn(`⚠️ [SecureStorage] Error eliminando de AsyncStorage: ${key}`);
  }
}

/**
 * Verificar si existe un valor
 */
export async function hasSecureItem(key: string): Promise<boolean> {
  const value = await getSecureItem(key);
  return value !== null;
}

/**
 * Obtener información de debug sobre el storage
 */
export async function getStorageDebugInfo(key: string): Promise<{
  inSecureStore: boolean;
  inAsyncStorage: boolean;
  inBackup: boolean;
  valueLength: number;
}> {
  let inSecureStore = false;
  let inAsyncStorage = false;
  let inBackup = false;
  let valueLength = 0;
  
  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue) {
      inSecureStore = true;
      valueLength = secureValue.length;
    }
  } catch (e) {
    console.warn(`Debug: Error checking SecureStore for ${key}`);
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
  
  return { inSecureStore, inAsyncStorage, inBackup, valueLength };
}
