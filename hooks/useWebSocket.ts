/**
 * 🎣 Hook useWebSocket - Gestión de eventos en tiempo real
 * 
 * Hook personalizado para suscribirse a canales y eventos de Laravel Reverb
 * 
 * Autor: GitHub Copilot
 * Fecha: 3 de octubre de 2025
 */

import { useEffect, useRef } from 'react';
import echoService from '@/services/echo';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Tipos de eventos disponibles
 */
export type WebSocketEvent = 
    | 'formulario.creado'
    | 'formulario.actualizado'
    | 'asistencia.marcada';

/**
 * Hook para suscribirse a un canal y eventos
 * 
 * @param channelName - Nombre del canal ('operaciones', 'registro.123', etc.)
 * @param eventName - Nombre del evento a escuchar
 * @param callback - Función que se ejecuta cuando llega el evento
 * 
 * @example
 * ```tsx
 * useWebSocket('operaciones', 'formulario.creado', (data) => {
 *   console.log('Nuevo formulario:', data);
 *   Alert.alert('Nuevo Formulario', data.mensaje);
 * });
 * ```
 */
export const useWebSocket = (
    channelName: string,
    eventName: WebSocketEvent,
    callback: (data: any) => void
) => {
    const { token } = useAuth();
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!token) {
            console.log('⚠️ No hay token, no se puede conectar a WebSocket');
            return;
        }

        // Obtener instancia de Echo con el token actual
        const echo = echoService.getEcho(token);

        console.log(`🔔 Suscribiéndose al canal: ${channelName}`);

        // Suscribirse al canal
        const channel = echo.channel(channelName);
        channelRef.current = channel;

        // Escuchar el evento
        channel.listen(`.${eventName}`, (data: any) => {
            console.log(`📢 Evento recibido [${eventName}]:`, data);
            callback(data);
        });

        // Limpiar suscripción al desmontar
        return () => {
            console.log(`🔕 Desuscribiéndose del canal: ${channelName}`);
            echo.leave(channelName);
            channelRef.current = null;
        };
    }, [channelName, eventName, callback, token]);

    return channelRef.current;
};

/**
 * Hook para canal de presencia (usuarios en línea)
 * 
 * @param channelName - Nombre del canal de presencia
 * @param callbacks - Callbacks para diferentes eventos de presencia
 * 
 * @example
 * ```tsx
 * const [onlineUsers, setOnlineUsers] = useState([]);
 * 
 * usePresenceChannel('online-users', {
 *   onHere: (users) => setOnlineUsers(users),
 *   onJoining: (user) => setOnlineUsers(prev => [...prev, user]),
 *   onLeaving: (user) => setOnlineUsers(prev => prev.filter(u => u.id !== user.id))
 * });
 * ```
 */
export const usePresenceChannel = (
    channelName: string,
    callbacks: {
        onHere?: (users: any[]) => void;
        onJoining?: (user: any) => void;
        onLeaving?: (user: any) => void;
    }
) => {
    const { token } = useAuth();
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!token) return;

        const echo = echoService.getEcho(token);

        console.log(`👥 Uniéndose al canal de presencia: ${channelName}`);

        const channel = echo.join(channelName);
        channelRef.current = channel;

        // Usuarios actuales en el canal
        if (callbacks.onHere) {
            channel.here((users: any[]) => {
                console.log(`👥 Usuarios actuales en ${channelName}:`, users.length);
                callbacks.onHere!(users);
            });
        }

        // Usuario se une
        if (callbacks.onJoining) {
            channel.joining((user: any) => {
                console.log('✅ Usuario se unió:', user.name);
                callbacks.onJoining!(user);
            });
        }

        // Usuario se va
        if (callbacks.onLeaving) {
            channel.leaving((user: any) => {
                console.log('❌ Usuario salió:', user.name);
                callbacks.onLeaving!(user);
            });
        }

        return () => {
            console.log(`👋 Saliendo del canal de presencia: ${channelName}`);
            echo.leave(channelName);
            channelRef.current = null;
        };
    }, [channelName, token]);

    return channelRef.current;
};

/**
 * Hook para escuchar múltiples eventos en un mismo canal
 * 
 * @param channelName - Nombre del canal
 * @param events - Objeto con eventos y sus callbacks
 * 
 * @example
 * ```tsx
 * useMultipleEvents('operaciones', {
 *   'formulario.creado': (data) => console.log('Creado:', data),
 *   'formulario.actualizado': (data) => console.log('Actualizado:', data),
 * });
 * ```
 */
export const useMultipleEvents = (
    channelName: string,
    events: Record<WebSocketEvent, (data: any) => void>
) => {
    const { token } = useAuth();
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!token) return;

        const echo = echoService.getEcho(token);
        const channel = echo.channel(channelName);
        channelRef.current = channel;

        console.log(`🔔 Suscribiéndose a ${Object.keys(events).length} eventos en: ${channelName}`);

        // Suscribirse a todos los eventos
        Object.entries(events).forEach(([eventName, callback]) => {
            channel.listen(`.${eventName}`, (data: any) => {
                console.log(`📢 [${eventName}]:`, data);
                callback(data);
            });
        });

        return () => {
            echo.leave(channelName);
            channelRef.current = null;
        };
    }, [channelName, events, token]);

    return channelRef.current;
};
