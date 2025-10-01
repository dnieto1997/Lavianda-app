import React from 'react';
import { LoadScript, GoogleMap, MarkerF, PolylineF } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBrbXAIzaSyAVBHloPPrI1Vniwac7IKFmgNYQTpmvqY0';

type LocationType = 'login' | 'logout' | string;

interface Location {
  latitude: number;
  longitude: number;
  type: LocationType;
}

interface AdminTrackingWebProps {
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  locations?: Location[];
}

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

export default function AdminTrackingWeb({ currentLocation, locations }: AdminTrackingWebProps) {
  const filteredMarkers = locations?.filter(
    (loc: Location) => loc.type === 'login' || loc.type === 'logout'
  ) || [];

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '400px' }}
        center={currentLocation ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
        } : { lat: 4.710989, lng: -74.072092 }}
        zoom={16}
      >
        {filteredMarkers && filteredMarkers.map((loc: Location, idx: number) => (
          <MarkerF
            key={idx}
            position={{ lat: loc.latitude, lng: loc.longitude }}
            label={loc.type}
            icon={{
              path: window.google && window.google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: getMarkerColor(loc.type),
              fillOpacity: 1,
              strokeWeight: 1,
            }}
          />
        ))}
        {filteredMarkers && filteredMarkers.length > 1 && (
          <PolylineF
            path={filteredMarkers.map((loc: Location) => ({ lat: loc.latitude, lng: loc.longitude }))}
            options={{ strokeColor: '#2196F3', strokeWeight: 2 }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
}