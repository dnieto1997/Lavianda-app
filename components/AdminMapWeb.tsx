import React from 'react';
import { LoadScript, GoogleMap, MarkerF, PolylineF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAVBHloPPrI1Vniwac7IKFmgNYQTpmvqY0';

type LocationType = 'login' | 'logout' | 'unknown' | string;

interface Location {
  latitude: number;
  longitude: number;
  type: LocationType;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

interface AdminMapWebProps {
  region?: Region;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  locations: Location[];
  mapContainerStyle?: any;
  zoom?: number;
}

export default function AdminMapWeb({ 
  region, 
  currentLocation, 
  locations, 
  mapContainerStyle,
  zoom = 16 
}: AdminMapWebProps) {
  
  console.log('🗺️ AdminMapWeb - Ubicaciones recibidas:', locations);

  // Calcular centro del mapa
  const center = currentLocation
    ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
    : locations.length > 0
    ? { lat: locations[0].latitude, lng: locations[0].longitude }
    : { lat: 10.96854, lng: -74.78132 }; // Barranquilla por defecto

  // Filtrar ubicaciones válidas
  const validLocations = locations.filter(
    (loc) =>
      typeof loc.latitude === 'number' &&
      typeof loc.longitude === 'number' &&
      !isNaN(loc.latitude) &&
      !isNaN(loc.longitude) &&
      loc.latitude !== 0 &&
      loc.longitude !== 0
  );

  console.log('✅ Ubicaciones válidas para renderizar:', validLocations);

  // Función para obtener color del marcador
  const getMarkerColor = (type: LocationType): string => {
    switch (type) {
      case 'login':
        return '#4CAF50';
      case 'logout':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  // Función para obtener el tamaño del marcador
  const getMarkerScale = (type: LocationType): number => {
    switch (type) {
      case 'login':
      case 'logout':
        return 24; // Grande para login/logout
      default:
        return 8; // Normal para otros
    }
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle || { width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
      >
        {/* Polilínea para mostrar el recorrido */}
        {validLocations.length > 1 && (
          <PolylineF
            path={validLocations.map((loc) => ({
              lat: loc.latitude,
              lng: loc.longitude,
            }))}
            options={{ 
              strokeColor: '#2196F3', 
              strokeWeight: 3,
              strokeOpacity: 0.8,
            }}
          />
        )}

        {/* Marcadores para TODOS los puntos válidos */}
        {validLocations.map((loc, idx) => (
          <MarkerF
            key={`marker-${idx}-${loc.latitude}-${loc.longitude}`}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            title={`${loc.type || 'Punto'} ${idx + 1}`}
            icon={{
              path: window.google?.maps.SymbolPath.CIRCLE,
              scale: getMarkerScale(loc.type),
              fillColor: getMarkerColor(loc.type),
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#fff',
            }}
            label={{
              text: loc.type === 'login' ? 'IN' : loc.type === 'logout' ? 'OUT' : `${idx + 1}`,
              color: '#fff',
              fontSize: loc.type === 'login' || loc.type === 'logout' ? '14px' : '12px',
              fontWeight: 'bold',
            }}
          />
        ))}

        {/* Marcador para ubicación actual */}
        {currentLocation && (
          <MarkerF
            position={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}
            title="Ubicación actual"
            icon={{
              path: window.google?.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#FF5722',
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#fff',
            }}
            label={{
              text: '●',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
}