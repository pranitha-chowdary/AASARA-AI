import { useState, useRef, useEffect, useCallback } from 'react';

// Telemetry Service Hook for Real-Time Data Collection
// Integrated with AASARA Core Processing Gateway
// Uses REAL browser Geolocation API with mock-sensor fallback

const GATEWAY_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5001';

interface GPSData {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: string;
}

interface SensorData {
  accelerometer: number[];
  gyroscope: number[];
  battery: { level: number; temperature: number; isCharging: boolean };
  pressure: { current: number; baseline: number };
  path: GPSData[];
}

// Fallback mock GPS (only used when browser denies permission)
function generateFallbackGPS(): GPSData {
  const baseLatitude = 19.0760;
  const baseLongitude = 72.8777;
  const variance = 0.002; // ~200m variance (realistic walking)
  return {
    lat: baseLatitude + (Math.random() - 0.5) * variance,
    lng: baseLongitude + (Math.random() - 0.5) * variance,
    accuracy: 5 + Math.random() * 15,
    speed: 1 + Math.random() * 4,
    heading: Math.random() * 360,
    altitude: null,
    timestamp: new Date().toISOString(),
  };
}

// Simulated sensor data (browsers don't reliably expose accelerometer/gyroscope)
function generateSensorData(path: GPSData[]): SensorData {
  // Derive pseudo-acceleration from GPS speed changes
  let accelEstimate = 0.5 + Math.random() * 2;
  if (path.length >= 2) {
    const prev = path[path.length - 2];
    const curr = path[path.length - 1];
    if (prev.speed != null && curr.speed != null) {
      accelEstimate = Math.abs(curr.speed - prev.speed) + 0.3 + Math.random() * 0.5;
    }
  }
  return {
    accelerometer: [
      accelEstimate,
      0.3 + Math.random() * 1.5,
      9.8 + Math.random() * 0.5,
    ],
    gyroscope: [Math.random() * 30, Math.random() * 30, Math.random() * 30],
    battery: {
      level: 40 + Math.random() * 50,
      temperature: 30 + Math.random() * 15,
      isCharging: false,
    },
    pressure: {
      current: 1013 + Math.random() * 10,
      baseline: 1013,
    },
    path: path.map(({ lat, lng, timestamp }) => ({ lat, lng, accuracy: 10, timestamp })),
  };
}

// Request real GPS from browser
function getRealGPS(): Promise<GPSData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
          timestamp: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 },
    );
  });
}

interface TelemetryService {
  telemetryStatus: string;
  gpsHistory: GPSData[];
  anomalyScore: number;
  lastSyncTime: string | null;
  currentLocation: GPSData | null;
  locationSource: 'real' | 'fallback' | null;
  startTelemetry: () => void;
  stopTelemetry: () => void;
}

// Main Telemetry Hook — real GPS with fallback
export function useTelemetryService(workerId: string): TelemetryService {
  const [telemetryStatus, setTelemetryStatus] = useState('idle');
  const [gpsHistory, setGpsHistory] = useState<GPSData[]>([]);
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GPSData | null>(null);
  const [locationSource, setLocationSource] = useState<'real' | 'fallback' | null>(null);
  const telemetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const historyRef = useRef<GPSData[]>([]);
  const latestPosRef = useRef<GPSData | null>(null);

  // Start telemetry stream
  const startTelemetry = useCallback(async () => {
    if (telemetryIntervalRef.current) return;

    setTelemetryStatus('requesting-permission');

    // Try to start continuous watch via Geolocation API
    let usingReal = false;
    if (navigator.geolocation) {
      try {
        // First get an initial position to confirm permission
        const initial = await getRealGPS();
        latestPosRef.current = initial;
        setCurrentLocation(initial);
        setLocationSource('real');
        usingReal = true;
        console.log('[Telemetry] ✅ Real GPS acquired — live tracking enabled');

        // Start continuous watch
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const gps: GPSData = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              altitude: pos.coords.altitude,
              timestamp: new Date(pos.timestamp).toISOString(),
            };
            latestPosRef.current = gps;
            setCurrentLocation(gps);
          },
          (err) => console.warn('[Telemetry] watchPosition error:', err.message),
          { enableHighAccuracy: true, maximumAge: 3000 },
        );
      } catch (err) {
        console.warn('[Telemetry] ⚠️ GPS permission denied — using fallback mock data');
        setLocationSource('fallback');
      }
    } else {
      setLocationSource('fallback');
    }

    setTelemetryStatus('streaming');

    // Sync telemetry to backend every 5 seconds
    telemetryIntervalRef.current = setInterval(async () => {
      try {
        const gps = usingReal && latestPosRef.current
          ? latestPosRef.current
          : generateFallbackGPS();

        historyRef.current.push(gps);
        if (historyRef.current.length > 20) historyRef.current.shift();

        const sensors = generateSensorData(historyRef.current);

        const response = await fetch(`${GATEWAY_URL}/api/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId,
            gps,
            status: 'online',
            sensors,
          }),
        });

        const data = await response.json();

        setGpsHistory([...historyRef.current]);
        setAnomalyScore(data.anomalyScore || 0);
        setLastSyncTime(new Date().toISOString());

        console.log(
          `[Telemetry] ${usingReal ? '📍 REAL' : '🔶 MOCK'} → (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}) Anomaly: ${data.anomalyScore}`,
        );
      } catch (error) {
        console.error('Telemetry sync error:', error);
      }
    }, 5000);
  }, [workerId]);

  // Stop telemetry stream
  const stopTelemetry = useCallback(() => {
    if (telemetryIntervalRef.current) {
      clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
    }
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    historyRef.current = [];
    setTelemetryStatus('idle');
    setLocationSource(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTelemetry();
  }, [stopTelemetry]);

  return {
    telemetryStatus,
    gpsHistory,
    anomalyScore,
    lastSyncTime,
    currentLocation,
    locationSource,
    startTelemetry,
    stopTelemetry,
  };
}

// Risk Premium Calculator Hook
export async function calculateWeeklyPremium() {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/premium/calculate`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Premium calculation error:', error);
    return { weeklyPremium: 40, riskTier: '🟡 Moderate' };
  }
}

// Disruption Trigger Function (Called by Weather Monitor)
export async function triggerDisruptionEvent(eventType: string, severity: number, zone: { lat: number; lng: number; radius: number }) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/disruption-trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        severity,
        zone,
        triggerTime: new Date().toISOString()
      })
    });
    
    const data = await response.json();
    console.log(`[Client] Disruption triggered - Payouts: ${data.payoutsTriggered}`);
    return data;
  } catch (error) {
    console.error('Disruption trigger error:', error);
  }
}

// Claim Validation Function
export async function validateClaim(workerId: string, disruptionId: string) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/validate-claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, disruptionId })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Claim validation error:', error);
  }
}

// Execute Payout
export async function executePayout(workerId: string, amount: number, upiId: string, disruptionId: string) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/payout/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId,
        amount,
        upiId,
        disruptionId
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Payout execution error:', error);
  }
}

// Micro-Verification via Photo
export async function submitMicroVerification(workerId: string, imageBase64: string) {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/micro-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId,
        imageBase64
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Micro-verification error:', error);
  }
}
