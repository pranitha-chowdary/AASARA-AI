import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';

interface Disruption {
  id: string;
  workerId: string;
  disruptionType: 'monsoon' | 'heatwave' | 'curfew' | 'pollution' | 'strike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolvedAt?: string;
  active: boolean;
}

interface DisruptionContextType {
  activeDisruption: Disruption | null;
  loading: boolean;
  error: string | null;
  startPolling: () => void;
  stopPolling: () => void;
  pollOnce: () => Promise<void>;
}

const DisruptionContext = createContext<DisruptionContextType | undefined>(undefined);

let pollInterval: NodeJS.Timeout | null = null;

export const DisruptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isWorker, user } = useAuth();
  const [activeDisruption, setActiveDisruption] = useState<Disruption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollOnce = useCallback(async () => {
    if (!isWorker || !user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const disruption = await apiService.checkActiveDisruption();
      setActiveDisruption(disruption || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check disruptions';
      setError(errorMessage);
      console.error('Disruption poll error:', err);
    } finally {
      setLoading(false);
    }
  }, [isWorker, user?.id]);

  const startPolling = useCallback(() => {
    if (pollInterval) return; // Already polling

    // Poll immediately
    pollOnce();

    // then every 5 seconds
    pollInterval = setInterval(() => {
      pollOnce();
    }, 5000);
  }, [pollOnce]);

  const stopPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }, []);

  // Start polling when component mounts for a worker (with 500ms delay)
  useEffect(() => {
    if (!isWorker) return;

    // Delay polling start to avoid blocking app startup
    const timer = setTimeout(() => {
      startPolling();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopPolling();
    };
  }, [isWorker, startPolling, stopPolling]);

  const value: DisruptionContextType = {
    activeDisruption,
    loading,
    error,
    startPolling,
    stopPolling,
    pollOnce,
  };

  return <DisruptionContext.Provider value={value}>{children}</DisruptionContext.Provider>;
};

export const useDisruption = () => {
  const context = useContext(DisruptionContext);
  if (!context) {
    throw new Error('useDisruption must be used within a DisruptionProvider');
  }
  return context;
};
