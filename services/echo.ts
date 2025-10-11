import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

if (typeof window !== 'undefined') {
    (window as any).Pusher = Pusher;
}

const REVERB_CONFIG = {
    broadcaster: 'reverb',
    key: 'operaciones-key-2025',
    wsHost: 'operaciones.lavianda.com.co',
    wsPort: 8080,
    wssPort: 8080,
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    cluster: 'mt1',
};

class EchoService {
    private static instance: EchoService;
    private echo: any = null;
    private token: string | null = null;

    private constructor() {}

    public static getInstance(): EchoService {
        if (!EchoService.instance) {
            EchoService.instance = new EchoService();
        }
        return EchoService.instance;
    }

    public async initializeWithToken(): Promise<any> {
        try {
            this.token = await AsyncStorage.getItem('authToken');
            if (!this.token) {
                console.log('🔧 No hay token - Usando WebSocket mock para desarrollo');
                // En desarrollo, devolver un objeto mock que simule Echo
                return {
                    channel: (name: string) => ({
                        listen: (event: string, callback: Function) => {
                            console.log(`🔧 Mock: Escuchando evento ${event} en canal ${name}`);
                            // Simular eventos cada 30 segundos para testing
                            if (name === 'tracking.updates') {
                                setInterval(() => {
                                    console.log(`🔧 Mock: Simulando evento ${event}`);
                                    callback({
                                        type: 'location_update',
                                        data: {
                                            user_id: Math.floor(Math.random() * 10) + 1,
                                            latitude: 4.60971 + (Math.random() - 0.5) * 0.01,
                                            longitude: -74.08175 + (Math.random() - 0.5) * 0.01,
                                            timestamp: new Date().toISOString()
                                        }
                                    });
                                }, 30000);
                            }
                        }
                    }),
                    leave: (channel: string) => {
                        console.log(`🔧 Mock: Saliendo del canal ${channel}`);
                    }
                };
            }
            
            console.log('✅ Token encontrado - Inicializando WebSocket real');
            return this.getEcho(this.token);
        } catch (error) {
            console.error('❌ Error obteniendo token para WebSocket:', error);
            return null;
        }
    }

    public getEcho(token?: string): any {
        if (!this.echo) {
            const authToken = token || this.token;
            
            const config: any = {
                ...REVERB_CONFIG,
                enabledTransports: [...REVERB_CONFIG.enabledTransports],
            };

            if (authToken) {
                config.auth = {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                        Accept: 'application/json',
                    },
                };
                config.authEndpoint = 'https://operaciones.lavianda.com.co/broadcasting/auth';
            }

            this.echo = new Echo(config);

            // Event listeners para conexión
            if (this.echo.connector && this.echo.connector.pusher) {
                this.echo.connector.pusher.connection.bind('connected', () => {
                    console.log('✅ WebSocket conectado exitosamente');
                });

                this.echo.connector.pusher.connection.bind('disconnected', () => {
                    console.log('⚠️ WebSocket desconectado');
                });

                this.echo.connector.pusher.connection.bind('error', (error: any) => {
                    console.error('❌ Error en WebSocket:', error);
                });
            }

            console.log('Echo WebSocket inicializado');
        }

        return this.echo;
    }

    public updateToken(token: string): void {
        this.token = token;
        if (this.echo) {
            this.disconnect();
            this.getEcho(token);
        }
    }

    public disconnect(): void {
        if (this.echo) {
            this.echo.disconnect();
            this.echo = null;
        }
    }

    public isConnected(): boolean {
        return this.echo !== null;
    }
}

// Crear instancia única y exportar un método para obtener Echo inicializado
const echoService = EchoService.getInstance();

// Exportar la instancia que se inicializará automáticamente
export default echoService;

// También exportar una función para obtener Echo directamente
export const getEcho = async () => {
    return await echoService.initializeWithToken();
};