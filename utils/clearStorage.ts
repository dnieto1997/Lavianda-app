/**
 * 🧹 Script de limpieza de storage
 * 
 * Ejecuta este script si necesitas limpiar completamente el storage
 * y forzar un nuevo login
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearAllStorage(): Promise<void> {
  console.log('🧹 Limpiando todo el storage...');
  
  try {
    // Limpiar SecureStore
    await SecureStore.deleteItemAsync('auth_token');
    console.log('✅ SecureStore limpiado');
  } catch (error) {
    console.warn('⚠️ Error limpiando SecureStore:', error);
  }
  
  try {
    // Limpiar AsyncStorage
    await AsyncStorage.multiRemove([
      'auth_token',
      'backup_auth_token',
      'active_tracking_session',
      'tracking_state',
      'offline_locations'
    ]);
    console.log('✅ AsyncStorage limpiado');
  } catch (error) {
    console.warn('⚠️ Error limpiando AsyncStorage:', error);
  }
  
  console.log('✅ Storage completamente limpio');
}

// Si necesitas ejecutar esto desde el navegador de desarrollo
if (typeof global !== 'undefined') {
  (global as any).clearAllStorage = clearAllStorage;
}
