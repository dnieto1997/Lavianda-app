import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

if (typeof window !== 'undefined') {
    (window as any).Pusher = Pusher;
}

const REVERB_CONFIG = {
    broadcaster: 'reverb',
    key: 'lavianda-reverb-key',
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

    private constructor() {}

    public static getInstance(): EchoService {
        if (!EchoService.instance) {
            EchoService.instance = new EchoService();
        }
        return EchoService.instance;
    }

    public getEcho(token?: string): any {
        if (!this.echo) {
            const config: any = {
                ...REVERB_CONFIG,
                enabledTransports: [...REVERB_CONFIG.enabledTransports],
            };

            if (token) {
                config.auth = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json',
                    },
                };
                config.authEndpoint = 'https://operaciones.lavianda.com.co/broadcasting/auth';
            }

            this.echo = new Echo(config);

            console.log('Echo WebSocket inicializado');
        }

        return this.echo;
    }

    public updateToken(token: string): void {
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

export default EchoService.getInstance();
