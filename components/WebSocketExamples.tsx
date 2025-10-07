/**
 * 📱 Ejemplo de implementación de WebSockets en React Native
 * 
 * Este archivo muestra cómo usar los WebSockets en diferentes pantallas
 * 
 * Autor: GitHub Copilot
 * Fecha: 3 de octubre de 2025
 */

import { useState, useCallback } from 'react';
import { View, Text, Alert, FlatList } from 'react-native';
import { useWebSocket, usePresenceChannel, useMultipleEvents } from '@/hooks/useWebSocket';

/**
 * EJEMPLO 1: Pantalla de Operaciones con notificaciones en tiempo real
 */
export function OperacionesScreenExample() {
    const [formularios, setFormularios] = useState<any[]>([]);

    // Escuchar cuando se crea un nuevo formulario
    useWebSocket('operaciones', 'formulario.creado', useCallback((data) => {
        // Mostrar notificación
        Alert.alert(
            '📝 Nuevo Formulario',
            `Se creó el formulario ${data.consecutivo} para ${data.empresa}`,
            [
                { text: 'Ver', onPress: () => {/* Navegar al formulario */} },
                { text: 'OK' }
            ]
        );

        // Añadir a la lista
        setFormularios(prev => [data, ...prev]);
    }, []));

    // Escuchar cuando se actualiza un formulario
    useWebSocket('operaciones', 'formulario.actualizado', useCallback((data) => {
        // Actualizar en la lista
        setFormularios(prev => 
            prev.map(f => f.id === data.id ? { ...f, ...data } : f)
        );
    }, []));

    return (
        <View>
            <Text>Total formularios: {formularios.length}</Text>
            <FlatList
                data={formularios}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <Text>{item.consecutivo} - {item.empresa}</Text>
                )}
            />
        </View>
    );
}

/**
 * EJEMPLO 2: Pantalla de Registro con actualizaciones específicas
 */
export function RegistroDetalleExample({ registroId }: { registroId: number }) {
    const [formulariosRegistro, setFormulariosRegistro] = useState<any[]>([]);

    // Escuchar solo los formularios de este registro específico
    useWebSocket(`registro.${registroId}`, 'formulario.creado', useCallback((data) => {
        console.log('📝 Nuevo formulario en este registro:', data);
        setFormulariosRegistro(prev => [data, ...prev]);
        
        // Opcional: Mostrar badge o indicador visual
        Alert.alert('Nuevo Formulario', data.mensaje);
    }, []));

    return (
        <View>
            <Text>Formularios del registro #{registroId}</Text>
            <FlatList
                data={formulariosRegistro}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <Text>{item.tipo}: {item.consecutivo}</Text>
                )}
            />
        </View>
    );
}

/**
 * EJEMPLO 3: Dashboard de Administración con múltiples eventos
 */
export function AdminDashboardExample() {
    const [stats, setStats] = useState({
        formulariosHoy: 0,
        asistenciasHoy: 0,
        ultimaActividad: null as any
    });

    // Escuchar múltiples eventos en el canal de admin
    useMultipleEvents('admin-dashboard', {
        'formulario.creado': useCallback((data) => {
            setStats(prev => ({
                ...prev,
                formulariosHoy: prev.formulariosHoy + 1,
                ultimaActividad: data
            }));
        }, []),
        
        'asistencia.marcada': useCallback((data) => {
            setStats(prev => ({
                ...prev,
                asistenciasHoy: prev.asistenciasHoy + 1,
                ultimaActividad: data
            }));
            
            // Mostrar notificación de asistencia
            Alert.alert(
                '🕒 Asistencia Marcada',
                `${data.usuario_nombre} marcó ${data.tipo}`
            );
        }, [])
    });

    return (
        <View>
            <Text>📊 Dashboard en Tiempo Real</Text>
            <Text>Formularios hoy: {stats.formulariosHoy}</Text>
            <Text>Asistencias hoy: {stats.asistenciasHoy}</Text>
            {stats.ultimaActividad && (
                <Text>Última actividad: {stats.ultimaActividad.mensaje}</Text>
            )}
        </View>
    );
}

/**
 * EJEMPLO 4: Usuarios en línea con canal de presencia
 */
export function OnlineUsersExample() {
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

    usePresenceChannel('online-users', {
        // Usuarios que ya están en el canal cuando te unes
        onHere: (users) => {
            console.log('👥 Usuarios actuales:', users);
            setOnlineUsers(users);
        },
        
        // Usuario se une al canal
        onJoining: (user) => {
            console.log('✅ Usuario conectado:', user.name);
            setOnlineUsers(prev => [...prev, user]);
            
            // Opcional: Mostrar toast
            Alert.alert(`${user.name} está en línea`);
        },
        
        // Usuario sale del canal
        onLeaving: (user) => {
            console.log('❌ Usuario desconectado:', user.name);
            setOnlineUsers(prev => prev.filter(u => u.id !== user.id));
        }
    });

    return (
        <View>
            <Text>👥 Usuarios en línea: {onlineUsers.length}</Text>
            <FlatList
                data={onlineUsers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View>
                        <Text>{item.name}</Text>
                        <Text>{item.role}</Text>
                    </View>
                )}
            />
        </View>
    );
}

/**
 * EJEMPLO 5: Colaboración en formulario (ver quién está editando)
 */
export function FormularioColaborativoExample({ formularioId }: { formularioId: number }) {
    const [editores, setEditores] = useState<any[]>([]);

    usePresenceChannel(`formulario.${formularioId}`, {
        onHere: setEditores,
        onJoining: (user) => {
            setEditores(prev => [...prev, user]);
            Alert.alert(`${user.name} está viendo este formulario`);
        },
        onLeaving: (user) => {
            setEditores(prev => prev.filter(u => u.id !== user.id));
        }
    });

    return (
        <View>
            {editores.length > 1 && (
                <View>
                    <Text>⚠️ Otros usuarios están viendo este formulario:</Text>
                    {editores.map(user => (
                        <Text key={user.id}>• {user.name}</Text>
                    ))}
                </View>
            )}
        </View>
    );
}

/**
 * GUÍA DE USO EN TUS COMPONENTES
 * 
 * 1. Importar el hook:
 * ```typescript
 * import { useWebSocket } from '@/hooks/useWebSocket';
 * ```
 * 
 * 2. Usar en tu componente:
 * ```typescript
 * useWebSocket('operaciones', 'formulario.creado', (data) => {
 *   console.log('Nuevo formulario:', data);
 *   // Tu lógica aquí
 * });
 * ```
 * 
 * 3. Asegúrate de tener el token en el AuthContext
 * 
 * 4. Los componentes se suscriben automáticamente al montarse
 *    y se desuscriben al desmontarse
 */

export default {
    OperacionesScreenExample,
    RegistroDetalleExample,
    AdminDashboardExample,
    OnlineUsersExample,
    FormularioColaborativoExample
};
