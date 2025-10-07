// --- MAPA WEB OPTIMIZADO CON MARCADORES DE INICIO/FIN Y FORMULARIOS ---
import React, { useState, useCallback } from 'react';
import { LoadScript, GoogleMap, MarkerF, PolylineF, InfoWindowF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAVBHloPPrI1Vniwac7IKFmgNYQTpmvqY0';

// --- Interfaces ---
interface LocationPoint {
  id?: number;
  latitude: number;
  longitude: number;
  type: 'login' | 'logout' | 'tracking' | 'form_start' | 'form_end' | 'break_start' | 'break_end' | string;
  user_id?: number;
  user_name?: string;
  timestamp?: string;
  session_id?: string;
  form_id?: number;
  form_type?: string;
  notes?: string;
  distance_from_previous?: number;
}

interface TrackingSession {
  session_id: string;
  user_id?: number;
  user_name?: string;
  start_time?: string;
  end_time?: string;
  tracking_date?: string;
  status?: 'active' | 'completed' | 'interrupted';
  points_count?: number;
  total_distance?: number;
  total_duration?: number;
  forms_completed?: number;
  locations: LocationPoint[];
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

interface AdminMapWebOptimizedProps {
  region?: Region;
  trackings: TrackingSession[];
  selectedSession?: TrackingSession | null;
  onSessionSelect?: (session: TrackingSession) => void;
  showRouteAnimation?: boolean;
  highlightFormPoints?: boolean;
  showStartEndMarkers?: boolean;
  mapContainerStyle?: any;
  zoom?: number;
}

export default function AdminMapWebOptimized({
  region,
  trackings = [],
  selectedSession,
  onSessionSelect,
  showRouteAnimation = false,
  highlightFormPoints = true,
  showStartEndMarkers = true,
  mapContainerStyle,
  zoom = 14
}: AdminMapWebOptimizedProps) {
  
  const [selectedMarker, setSelectedMarker] = useState<{location: LocationPoint, session: TrackingSession} | null>(null);
  
  console.log('🗺️ AdminMapWebOptimized - Sesiones recibidas:', trackings.length);
  console.log('🎯 Sesión seleccionada:', selectedSession?.session_id);
  
  // Debug: verificar las locaciones de cada sesión
  trackings.forEach((session, idx) => {
    const validLocations = session.locations?.filter(
      (loc) =>
        typeof loc.latitude === 'number' &&
        typeof loc.longitude === 'number' &&
        !isNaN(loc.latitude) &&
        !isNaN(loc.longitude) &&
        loc.latitude !== 0 &&
        loc.longitude !== 0
    ) || [];
    
    console.log(`📊 Sesión ${idx + 1} (${session.session_id}):`, {
      user: session.user_name,
      locations_count: session.locations?.length || 0,
      valid_locations_count: validLocations.length,
      status: session.status,
      first_location: validLocations[0],
      last_location: validLocations[validLocations.length - 1],
      can_draw_line: validLocations.length >= 2 ? '✅ SÍ' : '❌ NO (necesita 2+ puntos)'
    });
  });

  // Calcular centro del mapa
  const getCenter = () => {
    if (region) {
      return { lat: region.latitude, lng: region.longitude };
    }
    
    if (trackings.length > 0 && trackings[0].locations.length > 0) {
      const firstLoc = trackings[0].locations[0];
      return { lat: firstLoc.latitude, lng: firstLoc.longitude };
    }
    
    return { lat: 10.96854, lng: -74.78132 }; // Barranquilla por defecto
  };

  // Función para obtener color del marcador
  const getMarkerColor = (location: LocationPoint): string => {
    // Prioridad: inicio/fin de sesión
    if (location.type === 'login') return '#4CAF50'; // Verde para inicio
    if (location.type === 'logout') return '#F44336'; // Rojo para fin
    
    // Formularios
    if (location.form_id || location.type?.includes('form')) {
      return '#FF9800'; // Naranja para formularios
    }
    
    // Descansos
    if (location.type?.includes('break')) return '#9C27B0'; // Púrpura
    
    // Tracking normal
    return '#2196F3'; // Azul
  };

  // Función para obtener tamaño del marcador
  const getMarkerScale = (location: LocationPoint, isStart: boolean, isEnd: boolean): number => {
    if (isStart || isEnd) return 28; // Muy grande para inicio/fin
    if (location.type === 'login' || location.type === 'logout') return 24;
    if (location.form_id || location.type?.includes('form')) return 20; // Grande para formularios
    if (location.type?.includes('break')) return 16;
    return 8; // Pequeño para tracking normal
  };

  // Función para obtener label del marcador
  const getMarkerLabel = (location: LocationPoint, index: number, isStart: boolean, isEnd: boolean): string => {
    if (isStart) return '🚀';
    if (isEnd) return '🏁';
    if (location.type === 'login') return 'IN';
    if (location.type === 'logout') return 'OUT';
    if (location.form_id) return '📋';
    if (location.type?.includes('break')) return '☕';
    return `${index + 1}`;
  };

  // Función para obtener símbolo del marcador
  const getMarkerSymbol = (location: LocationPoint, isStart: boolean, isEnd: boolean) => {
    // Verificar que Google Maps esté cargado
    if (!window.google?.maps?.SymbolPath) {
      return undefined; // Retornar undefined si no está cargado aún
    }
    
    if (isStart || isEnd || location.type === 'login' || location.type === 'logout') {
      return window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW;
    }
    if (location.form_id || location.type?.includes('form')) {
      return window.google.maps.SymbolPath.CIRCLE;
    }
    return window.google.maps.SymbolPath.CIRCLE;
  };

  const handleMarkerClick = useCallback((location: LocationPoint, session: TrackingSession) => {
    setSelectedMarker({ location, session });
  }, []);

  const handleCloseInfoWindow = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return 'N/A';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(2)}km`;
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle || { width: '100%', height: '100%' }}
        center={getCenter()}
        zoom={zoom}
        options={{
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
        }}
      >
        {/* Renderizar cada sesión */}
        {trackings.map((session) => {
          const validLocations = session.locations.filter(
            (loc) =>
              typeof loc.latitude === 'number' &&
              typeof loc.longitude === 'number' &&
              !isNaN(loc.latitude) &&
              !isNaN(loc.longitude) &&
              loc.latitude !== 0 &&
              loc.longitude !== 0
          );

          if (validLocations.length === 0) return null;

          // Identificar punto de inicio y fin
          const startLocation = validLocations[0];
          const endLocation = validLocations[validLocations.length - 1];
          const isCompleted = session.status === 'completed' || session.end_time;

          // Color de la polilínea según sesión seleccionada
          const routeColor = selectedSession?.session_id === session.session_id 
            ? '#C62828' // Rojo vianda si está seleccionada
            : session.status === 'active' 
              ? '#4CAF50' // Verde si activa
              : '#2196F3'; // Azul si completada

          return (
            <React.Fragment key={session.session_id}>
              {/* Polilínea del recorrido */}
              {validLocations.length > 1 && (
                <PolylineF
                  path={validLocations.map((loc) => ({
                    lat: loc.latitude,
                    lng: loc.longitude,
                  }))}
                  options={{
                    strokeColor: routeColor,
                    strokeWeight: selectedSession?.session_id === session.session_id ? 5 : 3,
                    strokeOpacity: 0.8,
                    geodesic: true,
                  }}
                />
              )}

              {/* Marcadores */}
              {validLocations.map((loc, idx) => {
                const isStart = showStartEndMarkers && idx === 0;
                const isEnd = showStartEndMarkers && isCompleted && idx === validLocations.length - 1;
                const isFormPoint = highlightFormPoints && (loc.form_id || loc.type?.includes('form'));
                
                // Solo mostrar puntos importantes o todos si no hay filtro
                const shouldShow = isStart || isEnd || isFormPoint || 
                  loc.type === 'login' || loc.type === 'logout' || 
                  loc.type?.includes('break') ||
                  selectedSession?.session_id === session.session_id;

                if (!shouldShow) return null;

                // Obtener el símbolo del marcador (puede ser undefined si Google Maps no está cargado)
                const markerSymbol = getMarkerSymbol(loc, !!isStart, !!isEnd);

                return (
                  <MarkerF
                    key={`marker-${session.session_id}-${idx}-${loc.latitude}-${loc.longitude}`}
                    position={{ lat: loc.latitude, lng: loc.longitude }}
                    title={`${loc.user_name || 'Usuario'} - ${loc.type || 'Punto'}`}
                    onClick={() => handleMarkerClick(loc, session)}
                    icon={markerSymbol ? {
                      path: markerSymbol,
                      scale: getMarkerScale(loc, !!isStart, !!isEnd),
                      fillColor: getMarkerColor(loc),
                      fillOpacity: 1,
                      strokeWeight: 2,
                      strokeColor: '#fff',
                      rotation: isStart ? 0 : isEnd ? 180 : 0,
                    } : undefined}
                    label={
                      isStart || isEnd || isFormPoint ? {
                        text: getMarkerLabel(loc, idx, !!isStart, !!isEnd),
                        color: isStart || isEnd ? '#fff' : '#000',
                        fontSize: isStart || isEnd ? '16px' : '14px',
                        fontWeight: 'bold',
                      } : undefined
                    }
                    zIndex={isStart || isEnd ? 1000 : isFormPoint ? 500 : 100}
                  />
                );
              })}
            </React.Fragment>
          );
        })}

        {/* InfoWindow para el marcador seleccionado */}
        {selectedMarker && (
          <InfoWindowF
            position={{
              lat: selectedMarker.location.latitude,
              lng: selectedMarker.location.longitude,
            }}
            onCloseClick={handleCloseInfoWindow}
          >
            <div style={{ 
              padding: '12px', 
              maxWidth: '280px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#C62828'
              }}>
                {selectedMarker.session.user_name || 'Usuario'}
              </h3>
              
              <div style={{ marginBottom: '8px' }}>
                <strong>Tipo:</strong> {selectedMarker.location.type || 'tracking'}
              </div>
              
              {selectedMarker.location.timestamp && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Hora:</strong> {formatTime(selectedMarker.location.timestamp)}
                </div>
              )}
              
              {selectedMarker.location.form_id && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>📋 Formulario:</strong> #{selectedMarker.location.form_id}
                  {selectedMarker.location.form_type && ` (${selectedMarker.location.form_type})`}
                </div>
              )}
              
              {selectedMarker.location.distance_from_previous && (
                <div style={{ marginBottom: '8px' }}>
                  <strong>Distancia desde anterior:</strong> {formatDistance(selectedMarker.location.distance_from_previous)}
                </div>
              )}
              
              {selectedMarker.location.notes && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px', 
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}>
                  <strong>Nota:</strong><br/>
                  {selectedMarker.location.notes}
                </div>
              )}
              
              <div style={{ 
                marginTop: '12px', 
                fontSize: '12px', 
                color: '#757575',
                borderTop: '1px solid #e0e0e0',
                paddingTop: '8px'
              }}>
                <div>📍 Lat: {selectedMarker.location.latitude.toFixed(6)}</div>
                <div>📍 Lng: {selectedMarker.location.longitude.toFixed(6)}</div>
                <div>🆔 Sesión: {selectedMarker.session.session_id.substring(0, 8)}...</div>
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </LoadScript>
  );
}
