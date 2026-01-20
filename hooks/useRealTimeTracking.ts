import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getEcho } from "../services/echo";

/* ----------------------------------------------------------
   TIPOS
---------------------------------------------------------- */

interface UserLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  isOnline: boolean;
  lastActivity: string;
}

type LocationType =
  | "login"
  | "tracking"
  | "logout"
  | "Acta_de_Inicio"
  | "Formulario_Inpeccion"
  | "Informe_de_Supervisión"
  | "Inicio_servicio"
  | "Novedades_servicio";

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  type: LocationType;
  formId?: number | null;
  sessionId: string;
}

interface SessionRoute {
  id: string;
  userId: number;
  userName: string;
  startTime: string;
  endTime?: string;
  points: LocationPoint[];
  isActive: boolean;
  totalDistance: number;
}

interface FormMarker {
  id: number;
  latitude: number;
  longitude: number;
  consecutivo: string;
  empresa: string;
  timestamp: string;
  userName: string;
  type: LocationType;
}

interface TrackingDataResponse {
  success: boolean;
  data: any[];
}

interface UseRealTimeTrackingReturn {
  userLocations: UserLocation[];
  sessionRoutes: SessionRoute[];
  formMarkers: FormMarker[];
  selectedUserRoute: LocationPoint[];
  loading: boolean;
  isConnected: boolean;
  refreshData: () => Promise<void>;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  fetchUserLocationsByDate: (userId: number, date: string) => Promise<void>;
  fetchFormMarkers: (userId: number, date: string) => Promise<void>;
  startLiveTracking: (userId: number) => Promise<void>;
}

/* ----------------------------------------------------------
   CONFIG
---------------------------------------------------------- */

const API_BASE = "https://operaciones.lavianda.com.co/api";

/* ----------------------------------------------------------
   HOOK
---------------------------------------------------------- */

export const useRealTimeTracking = (): UseRealTimeTrackingReturn => {
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [sessionRoutes, setSessionRoutes] = useState<SessionRoute[]>([]);
  const [formMarkers, setFormMarkers] = useState<FormMarker[]>([]);
  const [selectedUserRoute, setSelectedUserRoute] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  /* ----------------------------------------------------------
     TOKEN (FIX DEFINITIVO)
  ---------------------------------------------------------- */

  const initToken = useCallback(async (): Promise<string | null> => {
    if (token) return token;

    const storedToken = await AsyncStorage.getItem("authToken");
    if (storedToken) {
      setToken(storedToken);
      return storedToken;
    }

    return null;
  }, [token]);

  /* ----------------------------------------------------------
     API
  ---------------------------------------------------------- */

  const fetchActiveUsers = useCallback(async () => {
    const authToken = await initToken();
    if (!authToken) return;

    try {
      const { data } = await axios.get(
        `${API_BASE}/admin/active-users-locations`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (data?.success) setUserLocations(data.users || []);
    } catch (e) {
      console.error("fetchActiveUsers", e);
    }
  }, [initToken]);

  const fetchSessionRoutes = useCallback(async () => {
    const authToken = await initToken();
    if (!authToken) return;

    try {
      const { data } = await axios.get(
        `${API_BASE}/admin/tracking/active-sessions`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (data?.success) setSessionRoutes(data.sessions || []);
    } catch (e) {
      console.error("fetchSessionRoutes", e);
    }
  }, [initToken]);

  const fetchFormMarkers = useCallback(
    async (userId: number, date: string) => {
      const authToken = await initToken();
      if (!authToken) return;

      try {
        const { data } = await axios.get(
          `${API_BASE}/admin/forms-locations?user_id=${userId}&date=${date}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        if (data?.success) setFormMarkers(data.forms || []);
      } catch (e) {
        console.error("fetchFormMarkers", e);
      }
    },
    [initToken]
  );

  const fetchUserLocationsByDate = useCallback(
    async (userId: number, date: string) => {
      const authToken = await initToken();
      if (!authToken) return;

      try {
        const { data } = await axios.get<TrackingDataResponse>(
          `${API_BASE}/locations?user_id=${userId}&date=${date}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        if (data?.success) {
          setSelectedUserRoute(
            data.data.map(p => ({
              latitude: Number(p.latitude),
              longitude: Number(p.longitude),
              timestamp: p.timestamp,
              type: p.type as LocationType,
              formId: p.formId ?? null,
              sessionId: p.sessionId,
            }))
          );
        } else {
          setSelectedUserRoute([]);
        }
      } catch (e) {
        console.error("fetchUserLocationsByDate", e);
        setSelectedUserRoute([]);
      }
    },
    [initToken]
  );

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchActiveUsers(), fetchSessionRoutes()]);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveUsers, fetchSessionRoutes]);

  /* ----------------------------------------------------------
     WEBSOCKET
  ---------------------------------------------------------- */

  const connectWebSocket = useCallback(async () => {
    const authToken = await initToken();
    if (!authToken) return;

    try {
      const echo = await getEcho();
      if (!echo) return;

      echo.channel("tracking").listen(".location.updated", (data: any) => {
        setUserLocations(prev => {
          const idx = prev.findIndex(u => u.id === data.userId);

          const updated: UserLocation = {
            id: data.userId,
            name: data.userName,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
            timestamp: data.timestamp,
            isOnline: true,
            lastActivity: data.timestamp,
          };

          return idx >= 0
            ? prev.map(u => (u.id === data.userId ? updated : u))
            : [...prev, updated];
        });
      });

      setIsConnected(true);
    } catch (e) {
      console.error("connectWebSocket", e);
      setIsConnected(false);
    }
  }, [initToken]);

  const disconnectWebSocket = useCallback(async () => {
    try {
      const echo = await getEcho();
      echo?.leave("tracking");
      setIsConnected(false);
    } catch {}
  }, []);

  const startLiveTracking = useCallback(async (userId: number) => {
    const echo = await getEcho();
    if (!echo) return;

    echo.leave(`user.${userId}`);
    echo.channel(`user.${userId}`).listen(".location.updated", (data: any) => {
      setSelectedUserRoute(prev => [
        ...prev,
        {
          latitude: data.latitude,
          longitude: data.longitude,
          timestamp: data.timestamp,
          type: "tracking",
          sessionId: data.sessionId,
        },
      ]);
    });
  }, []);

  /* ----------------------------------------------------------
     INIT
  ---------------------------------------------------------- */

  useEffect(() => {
    refreshData();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, []);

  /* ----------------------------------------------------------
     RETURN
  ---------------------------------------------------------- */

  return {
    userLocations,
    sessionRoutes,
    formMarkers,
    selectedUserRoute,
    loading,
    isConnected,
    refreshData,
    connectWebSocket,
    disconnectWebSocket,
    fetchUserLocationsByDate,
    fetchFormMarkers,
    startLiveTracking,
  };
};
