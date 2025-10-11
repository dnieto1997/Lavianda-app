export interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  type: 'login' | 'tracking' | 'logout';
  accuracy?: number;
  speed?: number;
}

export interface TrackingSession {
  id: string;
  userId: number;
  startTime: string;
  endTime?: string;
  locations: LocationPoint[];
  totalDistance?: number;
  isActive: boolean;
}

export interface LocationContextType {
  currentLocation: LocationPoint | null;
  trackingSession: TrackingSession | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  addLocationPoint: (type: 'login' | 'tracking' | 'logout') => Promise<void>;
}
