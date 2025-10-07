// Tipos compartidos para el sistema de mapas

export interface LocationPoint {
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
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery_level?: number;
}

export interface TrackingSession {
  session_id: string;
  user_id: number;
  user_name: string;
  user_email?: string;
  user_role?: string;
  start_time: string;
  end_time?: string;
  tracking_date: string;
  status: 'active' | 'completed' | 'interrupted';
  points_count: number;
  total_distance: number;
  total_duration: number;
  forms_completed: number;
  breaks_taken: number;
  locations: LocationPoint[];
}

export interface DayStats {
  date: string;
  total_sessions: number;
  total_distance: number;
  total_duration: number;
  total_forms: number;
  active_users: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface AdminMapProps {
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
