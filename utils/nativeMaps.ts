// utils/nativeMaps.ts
import { Platform } from 'react-native';

let RNMaps: any = {};

if (Platform.OS !== 'web') {
  // Solo lo cargamos en móvil
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  RNMaps = require('react-native-maps');
}

export default RNMaps;
