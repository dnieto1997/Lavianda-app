// Componente de mapa para WEB - evita importar react-native-maps
import AdminMapWebOptimized from './AdminMapWebOptimized';
import type { AdminMapProps } from '../types/map.types';

// Re-exportar con los tipos correctos
const AdminMapComponent: React.ComponentType<AdminMapProps> = AdminMapWebOptimized as any;

export default AdminMapComponent;
