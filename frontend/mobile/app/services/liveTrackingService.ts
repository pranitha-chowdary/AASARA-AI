/**
 * AASARA Live GPS Tracking Service
 * Uses expo-location watchPositionAsync for continuous real-time GPS tracking.
 * Streams location + sensor data to backend /api/telemetry every 5 seconds.
 * Feeds into the 3-Layer Fraud Engine (Isolation Forest + rule-based).
 */
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  // Reuse the same logic as api.ts but return base (no /api suffix)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5001/api';
  return 'http://localhost:5001/api';
};

const API_URL = getBaseUrl();

export interface GPSPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: string;
}

export interface TrackingState {
  isTracking: boolean;
  currentLocation: GPSPoint | null;
  pathHistory: GPSPoint[];
  anomalyScore: number;
  lastSyncTime: string | null;
  locationSource: 'real' | 'fallback';
}

type TrackingListener = (state: TrackingState) => void;

class LiveTrackingService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private accelSubscription: any = null;
  private gyroSubscription: any = null;
  private baroSubscription: any = null;

  private pathHistory: GPSPoint[] = [];
  private currentLocation: GPSPoint | null = null;
  private latestAccel: number[] = [0, 0, 9.8];
  private latestGyro: number[] = [0, 0, 0];
  private latestPressure: number = 1013;
  private anomalyScore: number = 0;
  private lastSyncTime: string | null = null;
  private isTracking: boolean = false;
  private locationSource: 'real' | 'fallback' = 'fallback';

  private listeners: Set<TrackingListener> = new Set();

  subscribe(listener: TrackingListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): TrackingState {
    return {
      isTracking: this.isTracking,
      currentLocation: this.currentLocation,
      pathHistory: [...this.pathHistory],
      anomalyScore: this.anomalyScore,
      lastSyncTime: this.lastSyncTime,
      locationSource: this.locationSource,
    };
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  async start(workerId: string): Promise<{ success: boolean; error?: string }> {
    if (this.isTracking) return { success: true };

    // 1. Request location permissions
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      return { success: false, error: 'Location permission denied' };
    }

    // Try background permission (non-blocking)
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {}

    this.isTracking = true;
    this.locationSource = 'real';

    // 2. Start continuous GPS watch
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,    // every 3 seconds
        distanceInterval: 2,   // or every 2 meters
      },
      (loc) => {
        const point: GPSPoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          altitude: loc.coords.altitude,
          timestamp: new Date(loc.timestamp).toISOString(),
        };
        this.currentLocation = point;
        this.pathHistory.push(point);
        if (this.pathHistory.length > 30) this.pathHistory.shift();
        this.emit();
      },
    );

    // 3. Start sensor listeners (gracefully — may not be available on all devices)
    try {
      Accelerometer.setUpdateInterval(1000);
      this.accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
        this.latestAccel = [x, y, z];
      });
    } catch {}

    try {
      Gyroscope.setUpdateInterval(1000);
      this.gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
        this.latestGyro = [x, y, z];
      });
    } catch {}

    try {
      Barometer.setUpdateInterval(5000);
      this.baroSubscription = Barometer.addListener(({ pressure }) => {
        this.latestPressure = pressure;
      });
    } catch {}

    // 4. Sync to backend every 5 seconds
    this.syncInterval = setInterval(() => this.syncTelemetry(workerId), 5000);

    // Initial sync
    const initialLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    this.currentLocation = {
      lat: initialLoc.coords.latitude,
      lng: initialLoc.coords.longitude,
      accuracy: initialLoc.coords.accuracy,
      speed: initialLoc.coords.speed,
      heading: initialLoc.coords.heading,
      altitude: initialLoc.coords.altitude,
      timestamp: new Date(initialLoc.timestamp).toISOString(),
    };
    this.pathHistory.push(this.currentLocation);

    this.emit();
    console.log('[LiveTracking] ✅ Started — real GPS + sensors active');
    return { success: true };
  }

  stop() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }
    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }
    if (this.baroSubscription) {
      this.baroSubscription.remove();
      this.baroSubscription = null;
    }
    this.isTracking = false;
    this.pathHistory = [];
    this.currentLocation = null;
    this.anomalyScore = 0;
    this.emit();
    console.log('[LiveTracking] ⏹ Stopped');
  }

  private async syncTelemetry(workerId: string) {
    if (!this.currentLocation) return;

    const gps = this.currentLocation;
    const pathForServer = this.pathHistory.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
    }));

    const payload = {
      workerId,
      gps: {
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy,
        timestamp: gps.timestamp,
      },
      status: 'online',
      sensors: {
        accelerometer: this.latestAccel,
        gyroscope: this.latestGyro,
        battery: {
          level: 75,
          temperature: 32,
          isCharging: false,
        },
        pressure: {
          current: this.latestPressure,
          baseline: 1013,
        },
        path: pathForServer,
      },
    };

    try {
      const token = await AsyncStorage.getItem('authToken');
      const resp = await fetch(`${API_URL}/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      this.anomalyScore = data.anomalyScore || 0;
      this.lastSyncTime = new Date().toISOString();
      this.emit();
    } catch (err) {
      console.warn('[LiveTracking] Sync error:', err);
    }
  }
}

// Singleton
export const liveTrackingService = new LiveTrackingService();
