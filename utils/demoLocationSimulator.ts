// ============================================
// 🎮 SIMULADOR DE UBICACIONES PARA PRUEBAS
// ============================================

export interface SimulatedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  timestamp: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  name?: string;
}

// 📍 Ubicaciones reales de Barranquilla para simular rutas
const BARRANQUILLA_ROUTES = {
  // Ruta 1: Zona Norte (Centro Comercial a Zona Residencial)
  route1: [
    { lat: 10.96854, lng: -74.78132, name: "Centro Único" },
    { lat: 10.97000, lng: -74.78200, name: "Calle 45" },
    { lat: 10.97150, lng: -74.78300, name: "Calle 47" },
    { lat: 10.97300, lng: -74.78450, name: "Av. Circunvalar" },
    { lat: 10.97450, lng: -74.78600, name: "Calle 51" },
    { lat: 10.97600, lng: -74.78750, name: "Buenavista" },
    { lat: 10.97750, lng: -74.78900, name: "Calle 55" },
    { lat: 10.97900, lng: -74.79050, name: "Zona Residencial" },
  ],
  
  // Ruta 2: Centro Histórico
  route2: [
    { lat: 11.00700, lng: -74.80800, name: "Plaza de Bolívar" },
    { lat: 11.00750, lng: -74.80750, name: "Catedral" },
    { lat: 11.00800, lng: -74.80700, name: "Casa de Gobierno" },
    { lat: 11.00850, lng: -74.80650, name: "Paseo Bolívar" },
    { lat: 11.00900, lng: -74.80600, name: "Camellón Abello" },
    { lat: 11.00950, lng: -74.80550, name: "Museo del Caribe" },
  ],
  
  // Ruta 3: Zona Industrial
  route3: [
    { lat: 10.95000, lng: -74.78000, name: "Zona Industrial" },
    { lat: 10.95200, lng: -74.78100, name: "Bodega A" },
    { lat: 10.95400, lng: -74.78200, name: "Bodega B" },
    { lat: 10.95600, lng: -74.78300, name: "Almacén" },
    { lat: 10.95800, lng: -74.78400, name: "Distribuidora" },
    { lat: 10.96000, lng: -74.78500, name: "Centro Logístico" },
  ],
};

// 🎲 Generar ruta aleatoria entre dos puntos
export function generateRandomRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  pointsCount: number = 10
): RoutePoint[] {
  const points: RoutePoint[] = [start];
  
  const latStep = (end.lat - start.lat) / (pointsCount - 1);
  const lngStep = (end.lng - start.lng) / (pointsCount - 1);
  
  for (let i = 1; i < pointsCount - 1; i++) {
    // Agregar variación aleatoria para hacer la ruta más realista
    const randomLatVariation = (Math.random() - 0.5) * 0.0005;
    const randomLngVariation = (Math.random() - 0.5) * 0.0005;
    
    points.push({
      lat: start.lat + (latStep * i) + randomLatVariation,
      lng: start.lng + (lngStep * i) + randomLngVariation,
    });
  }
  
  points.push(end);
  return points;
}

// 🗺️ Obtener ruta predefinida
export function getPresetRoute(routeName: keyof typeof BARRANQUILLA_ROUTES): RoutePoint[] {
  return BARRANQUILLA_ROUTES[routeName] || BARRANQUILLA_ROUTES.route1;
}

// 🎯 Simular ubicación con datos realistas
export function simulateLocation(
  point: RoutePoint,
  index: number,
  totalPoints: number
): SimulatedLocation {
  // Calcular velocidad simulada (más rápido en el medio, más lento al inicio/fin)
  const speedFactor = Math.sin((index / totalPoints) * Math.PI);
  const speed = 5 + (speedFactor * 15); // Entre 5-20 km/h
  
  // Calcular heading (dirección) hacia el siguiente punto
  const heading = Math.random() * 360;
  
  return {
    latitude: point.lat,
    longitude: point.lng,
    accuracy: 10 + Math.random() * 10, // 10-20 metros
    speed: speed,
    heading: heading,
    altitude: 5 + Math.random() * 10, // 5-15 metros sobre el nivel del mar
    timestamp: Date.now(),
  };
}

// 🚶 Simular recorrido completo con delays
export class RouteSimulator {
  private route: RoutePoint[];
  private currentIndex: number = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private onLocationUpdate?: (location: SimulatedLocation, progress: number) => void;
  private onComplete?: () => void;
  
  constructor(route: RoutePoint[]) {
    this.route = route;
  }
  
  // Iniciar simulación
  start(
    intervalMs: number = 3000, // Enviar ubicación cada 3 segundos (más rápido para pruebas)
    onLocationUpdate?: (location: SimulatedLocation, progress: number) => void,
    onComplete?: () => void
  ) {
    this.onLocationUpdate = onLocationUpdate;
    this.onComplete = onComplete;
    this.currentIndex = 0;
    
    // Enviar primera ubicación inmediatamente
    this.sendCurrentLocation();
    
    // Configurar interval para las siguientes
    this.intervalId = setInterval(() => {
      this.currentIndex++;
      
      if (this.currentIndex >= this.route.length) {
        this.stop();
        if (this.onComplete) this.onComplete();
        return;
      }
      
      this.sendCurrentLocation();
    }, intervalMs);
  }
  
  private sendCurrentLocation() {
    const point = this.route[this.currentIndex];
    const location = simulateLocation(point, this.currentIndex, this.route.length);
    const progress = (this.currentIndex / (this.route.length - 1)) * 100;
    
    if (this.onLocationUpdate) {
      this.onLocationUpdate(location, progress);
    }
  }
  
  // Detener simulación
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  // Obtener progreso actual
  getProgress(): number {
    return (this.currentIndex / (this.route.length - 1)) * 100;
  }
  
  // Reiniciar simulación
  reset() {
    this.stop();
    this.currentIndex = 0;
  }
}

// 🎮 Simulador de múltiples usuarios
export class MultiUserSimulator {
  private simulators: Map<string, RouteSimulator> = new Map();
  
  addUser(userId: string, route: RoutePoint[]) {
    const simulator = new RouteSimulator(route);
    this.simulators.set(userId, simulator);
    return simulator;
  }
  
  startAll(intervalMs: number = 3000) {
    this.simulators.forEach(simulator => simulator.start(intervalMs));
  }
  
  stopAll() {
    this.simulators.forEach(simulator => simulator.stop());
  }
  
  getSimulator(userId: string): RouteSimulator | undefined {
    return this.simulators.get(userId);
  }
}

// 📊 Generar datos de sesión completa para demo
export interface DemoSession {
  session_id: string;
  user_id: number;
  user_name: string;
  status: 'active' | 'completed';
  start_time: string;
  end_time?: string;
  locations: Array<{
    id: number;
    latitude: number;
    longitude: number;
    type: string;
    timestamp: string;
    accuracy: number;
    speed: number;
  }>;
}

export function generateDemoSession(
  userName: string,
  routeName: keyof typeof BARRANQUILLA_ROUTES = 'route1',
  pointsCount: number = 15
): DemoSession {
  const route = getPresetRoute(routeName);
  const sessionId = `demo_${Date.now()}`;
  const startTime = new Date();
  
  // Generar ubicaciones a lo largo de la ruta
  const locations = route.map((point, index) => {
    const simLocation = simulateLocation(point, index, route.length);
    const timestamp = new Date(startTime.getTime() + (index * 30000)); // 30s entre puntos
    
    return {
      id: index + 1,
      latitude: simLocation.latitude,
      longitude: simLocation.longitude,
      type: index === 0 ? 'login' : index === route.length - 1 ? 'logout' : 'tracking',
      timestamp: timestamp.toISOString(),
      accuracy: simLocation.accuracy,
      speed: simLocation.speed,
    };
  });
  
  const endTime = new Date(startTime.getTime() + (route.length * 30000));
  
  return {
    session_id: sessionId,
    user_id: Math.floor(Math.random() * 1000),
    user_name: userName,
    status: 'completed',
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    locations,
  };
}

// 🎯 Generar múltiples sesiones demo
export function generateMultipleDemoSessions(count: number = 3): DemoSession[] {
  const routes: Array<keyof typeof BARRANQUILLA_ROUTES> = ['route1', 'route2', 'route3'];
  const users = ['Juan Pérez', 'María García', 'Carlos López', 'Ana Martínez', 'Luis Rodríguez'];
  
  return Array.from({ length: count }, (_, i) => {
    const routeName = routes[i % routes.length];
    const userName = users[i % users.length];
    return generateDemoSession(userName, routeName);
  });
}
