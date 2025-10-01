import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useAuth } from '../app/_layout';

interface TrackingSession {
  sessionId: string;
  startedAt: string;
  isActive: boolean;
  totalPoints: number;
  totalDistance: number;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

interface TrackingContextType {
  isTracking: boolean;
  currentSession: TrackingSession | null;
  startTracking: () => Promise<boolean>;
  stopTracking: () => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  addFormPoint: (formId: number, type: 'start' | 'end', notes?: string) => Promise<void>;
  isPaused: boolean;
  error: string | null;
  isBackgroundActive: boolean;
}

const TrackingContext = createContext<TrackingContextType | null>(null);

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking debe usarse dentro de un TrackingProvider');
  }
  return context;
};

interface TrackingProviderProps {
  children: React.ReactNode;
}

export const TrackingProvider: React.FC<TrackingProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSession, setCurrentSession] = useState<TrackingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const {
    location,
    trackingSession,
    isBackgroundActive,
    startNewTrackingSession,
    endTrackingSession,
    sendFormLocationPoint,
    error: trackingError
  } = useLocationTracking(user?.token || null, isTracking && !isPaused);

  console.log('🔍 [TrackingContext] Estado del tracking:', {
    isTracking,
    isPaused,
    hasToken: !!user?.token,
    trackingSession: trackingSession?.sessionId,
    hookActive: isTracking && !isPaused
  });

  const appState = useRef(AppState.currentState);

  // Manejar cambios en el estado de la aplicación
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`🔄 Tracking Context: App state cambió de ${appState.current} a ${nextAppState}`);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      console.log('📱 Tracking Context: App volvió a primer plano');
      // Restaurar estado de tracking si estaba activo
      restoreTrackingState();
    } else if (nextAppState.match(/inactive|background/) && isTracking && !isPaused) {
      console.log('📱 Tracking Context: App pasó a segundo plano - manteniendo tracking');
      // El tracking continúa en segundo plano
    }
    
    appState.current = nextAppState;
  };

  // Restaurar estado de tracking desde AsyncStorage
  const restoreTrackingState = async () => {
    try {
      const trackingState = await AsyncStorage.getItem('tracking_state');
      if (trackingState) {
        const state = JSON.parse(trackingState);
        if (state.isActive) {
          setIsTracking(true);
          setIsPaused(state.isPaused || false);
          setCurrentSession(state.session);
          console.log('🔄 Estado de tracking restaurado desde AsyncStorage');
        }
      }
    } catch (error) {
      console.error('❌ Error restaurando estado de tracking:', error);
    }
  };

  // Guardar estado de tracking en AsyncStorage
  const saveTrackingState = async () => {
    try {
      const trackingState = {
        isActive: isTracking,
        isPaused,
        session: currentSession,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem('tracking_state', JSON.stringify(trackingState));
    } catch (error) {
      console.error('❌ Error guardando estado de tracking:', error);
    }
  };

  // Guardar estado cuando cambie
  useEffect(() => {
    if (isTracking || currentSession) {
      saveTrackingState();
    }
  }, [isTracking, isPaused, currentSession]);

  // Sincronizar con el hook de tracking
  useEffect(() => {
    if (trackingSession) {
      setCurrentSession({
        sessionId: trackingSession.sessionId,
        startedAt: trackingSession.startedAt,
        isActive: trackingSession.isActive,
        totalPoints: trackingSession.totalPoints,
        totalDistance: 0, // Se calculará en el backend
        lastLocation: trackingSession.lastLocation
      });
    }
  }, [trackingSession]);

  useEffect(() => {
    setError(trackingError);
  }, [trackingError]);

  // Restaurar estado al inicializar
  useEffect(() => {
    restoreTrackingState();
  }, []);

  const startTracking = async (): Promise<boolean> => {
    try {
      setError(null);
      
      if (!user?.token) {
        setError('No hay sesión de usuario activa');
        return false;
      }

      console.log('🚀 Iniciando tracking desde contexto...');
      
      // Primero activar el tracking para que el hook se inicie
      setIsTracking(true);
      setIsPaused(false);
      
      // Esperar un poco para que el hook se inicialice
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // El hook ahora debería estar activo y crear/restaurar la sesión automáticamente
      console.log('✅ Tracking iniciado exitosamente');
      return true;
      
    } catch (error) {
      console.error('❌ Error iniciando tracking:', error);
      setError('Error al iniciar el tracking');
      setIsTracking(false);
      return false;
    }
  };

  const stopTracking = async (): Promise<void> => {
    try {
      console.log('🛑 Deteniendo tracking desde contexto...');
      
      if (currentSession && location) {
        await endTrackingSession(location);
      }
      
      setIsTracking(false);
      setIsPaused(false);
      setCurrentSession(null);
      
      // Limpiar estado guardado
      await AsyncStorage.removeItem('tracking_state');
      
      console.log('✅ Tracking detenido exitosamente');
      
    } catch (error) {
      console.error('❌ Error deteniendo tracking:', error);
      setError('Error al detener el tracking');
    }
  };

  const pauseTracking = (): void => {
    console.log('⏸️ Pausando tracking...');
    setIsPaused(true);
  };

  const resumeTracking = (): void => {
    console.log('▶️ Reanudando tracking...');
    setIsPaused(false);
  };

  const addFormPoint = async (formId: number, type: 'start' | 'end', notes?: string): Promise<void> => {
    if (!isTracking || !sendFormLocationPoint) {
      console.warn('⚠️ No se puede enviar punto de formulario: tracking no activo');
      return;
    }

    try {
      await sendFormLocationPoint(formId, type, notes);
      console.log(`✅ Punto de formulario enviado (${type}) para formulario ${formId}`);
    } catch (error) {
      console.error('❌ Error enviando punto de formulario:', error);
      setError('Error al enviar punto de formulario');
    }
  };

  const contextValue: TrackingContextType = {
    isTracking,
    currentSession,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    addFormPoint,
    isPaused,
    error,
    isBackgroundActive
  };

  return (
    <TrackingContext.Provider value={contextValue}>
      {children}
    </TrackingContext.Provider>
  );
};
