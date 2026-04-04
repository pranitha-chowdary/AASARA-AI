import { useState, useRef, useEffect, useCallback } from 'react';

// Telemetry Service Hook for Real-Time Data Collection
// Integrated with AASARA Core Processing Gateway (http://localhost:5001)

const GATEWAY_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_GATEWAY_URL || 'http://localhost:5001';

interface GPSData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

interface SensorData {
  accelerometer: number[];
  gyroscope: number[];
  battery: { level: number; temperature: number; isCharging: boolean };
  pressure: { current: number; baseline: number };
  path: GPSData[];
}

// Mock GPS location generator (Hackathon only)
function generateMockGPS(): GPSData {
  // Mumbai delivery zones
  const baseLatitude = 19.0760;
  const baseLongitude = 72.8777;
  const variance = 0.05; // ~5km variance
  
  return {
    lat: baseLatitude + (Math.random() - 0.5) * variance,
    lng: baseLongitude + (Math.random() - 0.5) * variance,
    accuracy: 5 + Math.random() * 15,
    timestamp: new Date().toISOString()
  };
}

// Mock sensor data generator
function generateMockSensors(): SensorData {
  return {
    accelerometer: [
      0.5 + Math.random() * 2,
      0.3 + Math.random() * 1.5,
      9.8 + Math.random() * 0.5
    ],
    gyroscope: [Math.random() * 30, Math.random() * 30, Math.random() * 30],
    battery: {
      level: 40 + Math.random() * 50,
      temperature: 30 + Math.random() * 15,
      isCharging: false
    },
    pressure: {
      current: 1013 + Math.random() * 10,
      baseline: 1013
    },
    path: [] // Will be populated with GPS history
  };
}

interface TelemetryService {
  telemetryStatus: string;
  gpsHistory: GPSData[];
  anomalyScore: number;
  lastSyncTime: string | null;
  startTelemetry: () => void;
  stopTelemetry: () => void;
}

// Main Telemetry Hook
export function useTelemetryService(workerId: string): TelemetryService {
  const [telemetryStatus, setTelemetryStatus] = useState('idle');
  const [gpsHistory, setGpsHistory] = useState<GPSData[]>([]);
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const telemetryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start telemetry stream
  const startTelemetry = useCallback(async () => {
    if (telemetryIntervalRef.current) return;
    
    setTelemetryStatus('streaming');
    const history: GPSData[] = [];

    telemetryIntervalRef.current = setInterval(async () => {
      try {
        const gps = generateMockGPS();
        const sensors = generateMockSensors();
        
        history.push(gps);
        if (history.length > 10) history.shift(); // Keep last 10 points
        sensors.path = history;

        const response = await fetch(`${GATEWAY_URL}/api/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId,
            gps,
            status: 'online',
            sensors
          })
        });

        const data = await response.json();
        
        setGpsHistory(history);
        setAnomalyScore(data.anomalyScore || 0);
        setLastSyncTime(new Date().toISOString());
        
        console.log(`[Client] Telemetry synced - Anomaly: ${data.anomalyScore}`);
      } catch (error) {
        console.error('Telemetry sync error:', error);
      }
    }, 3000); // Send every 3 seconds
  }, [workerId]);

  // Stop telemetry stream
  const stopTelemetry = useCallback(() => {
    if (telemetryIntervalRef.current) {
      clearInterval(telemetryIntervalRef.current);
      telemetryIntervalRef.current = null;
    }
    setTelemetryStatus('idle');
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
    startTelemetry,
    stopTelemetry
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
