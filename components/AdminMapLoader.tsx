// --- Wrapper para cargar mapa según plataforma (evita importar react-native-maps en web) ---
import { Platform } from 'react-native';

// Este archivo usa importación dinámica para evitar que webpack procese react-native-maps en web
export default function getAdminMapComponent() {
  if (Platform.OS === 'web') {
    return require('./AdminMapWeb').default;
  } else {
    // Esta importación solo se ejecuta en tiempo de ejecución en plataformas nativas
    return require('./native-only/AdminMapMobile').default;
  }
}
