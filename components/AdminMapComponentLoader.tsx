// Componente de mapa para NATIVO - importa react-native-maps
import AdminMapMobileOptimized from './native-only/AdminMapMobileOptimized';
import type { AdminMapProps } from '../types/map.types';

// Re-exportar con los tipos correctos
const AdminMapComponent: React.ComponentType<AdminMapProps> = AdminMapMobileOptimized as any;

export default AdminMapComponent;
