// --- START OF FILE components/native-only/AdminMapMobile.tsx (Versión Final) ---

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';

// Detectar si estamos en Expo Go
const isExpoGo = Constants.appOwnership === 'expo';
const isWeb = Platform.OS === 'web';

// Solo importar MapView si NO estamos en Expo Go NI en Web
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (!isExpoGo && !isWeb) {
  try {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Polyline = maps.Polyline;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch (e) {
    console.log('react-native-maps no disponible');
  }
}

// --- Interfaces (Opcional pero recomendado) ---
interface LocationPoint {
  latitude: number;
  longitude: number;
  type: string;
  user_name?: string;
  timestamp?: string;
}

interface TrackingSession {
  session_id: string;
  locations: LocationPoint[];
}

interface AdminMapMobileProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null;
  trackings: TrackingSession[];
}

const AdminMapMobile = ({ region, trackings }: AdminMapMobileProps) => {
  // Si no hay región, no renderizamos el mapa para evitar errores.
  if (!region) {
    return null;
  }

  // Si estamos en Web, no renderizamos nada (se usa AdminMapWeb)
  if (isWeb) {
    return null;
  }

  // Si estamos en Expo Go, mostrar mensaje informativo con datos
  if (isExpoGo || !MapView) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.message}>
          Vista de Tracking
        </Text>
        <Text style={styles.submessage}>
          Mapas nativos no disponibles en Expo Go
        </Text>
        {region && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>📍 Ubicación Central:</Text>
            <Text style={styles.infoText}>
              Latitud: {region.latitude.toFixed(6)}
            </Text>
            <Text style={styles.infoText}>
              Longitud: {region.longitude.toFixed(6)}
            </Text>
            
            {trackings.length > 0 && (
              <>
                <Text style={styles.infoTitle}>{'\n'}📊 Datos de Tracking:</Text>
                <Text style={styles.infoText}>
                  • {trackings.length} sesión(es) activa(s)
                </Text>
                {trackings.map((session, idx) => (
                  <View key={session.session_id} style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle}>
                      Sesión {idx + 1}: {session.session_id.substring(0, 8)}...
                    </Text>
                    <Text style={styles.infoText}>
                      • {session.locations.length} puntos de ubicación
                    </Text>
                    {session.locations.length > 0 && (
                      <>
                        <Text style={styles.infoText}>
                          • Inicio: {new Date(session.locations[0].timestamp || '').toLocaleTimeString('es-CO')}
                        </Text>
                        {session.locations[session.locations.length - 1] && (
                          <Text style={styles.infoText}>
                            • Último: {new Date(session.locations[session.locations.length - 1].timestamp || '').toLocaleTimeString('es-CO')}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}
        <Text style={styles.note}>
          💡 Para ver el mapa real, necesitas:{'\n'}
          • Usar la versión web (presiona 'w'){'\n'}
          • O compilar una APK con EAS Build
        </Text>
      </View>
    );
  }

  // Código del mapa real para builds nativos
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      region={region}
      showsUserLocation
      loadingEnabled
    >
      {trackings.map(session => (
        <React.Fragment key={session.session_id}>
          {session.locations.length > 1 && (
            <Polyline
              coordinates={session.locations.map(loc => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
              }))}
              strokeColor="#1976D2"
              strokeWidth={4}
            />
          )}
          {session.locations.map((location, idx) => {
            if (location.type === 'login' || location.type === 'logout') {
              return (
                <Marker
                  key={`${session.session_id}-${idx}`}
                  coordinate={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                  }}
                  title={location.user_name || 'Evento de Ubicación'}
                  description={`Tipo: ${location.type} - ${new Date(location.timestamp || '').toLocaleString()}`}
                  pinColor={location.type === 'login' ? 'green' : 'red'}
                />
              );
            }
            return null;
          })}
        </React.Fragment>
      ))}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    padding: 20,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  message: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
  },
  submessage: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 20,
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
  },
  note: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 10,
  },
  sessionInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2980b9',
    marginBottom: 5,
  },
});

export default AdminMapMobile;