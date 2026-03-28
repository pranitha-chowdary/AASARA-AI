import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power,
  Shield,
  Navigation,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Activity,
  Zap,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTelemetryService, calculateWeeklyPremium, triggerDisruptionEvent } from '../services/telemetryService';

const GATEWAY_URL = 'http://localhost:5001';

export function RealTimeDashboard() {
  const { workerProfile, user, signOut } = useAuth();
  const workerId = workerProfile?.id || 'demo-worker-01';
  
  // Telemetry & Real-Time State
  const telemetry = useTelemetryService(workerId);
  const [isOnline, setIsOnline] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  
  // Load subscription data from MongoDB (not localStorage)
  const [premium, setPremium] = useState(40);
  const [riskTier, setRiskTier] = useState('🟡 Moderate');
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [activeDisruption, setActiveDisruption] = useState<any>(null);
  const [disruptionCheckLoading, setDisruptionCheckLoading] = useState(false);

  useEffect(() => {
    loadShiftStatus();
    loadSubscriptionFromDatabase();
    checkActiveDisruption();
    
    // Check for disruptions every 5 seconds
    const disruptionInterval = setInterval(checkActiveDisruption, 5000);
    return () => clearInterval(disruptionInterval);
  }, [workerProfile]);

  const loadShiftStatus = async () => {
    if (!workerProfile) return;
    const { data } = await supabase
      .from('active_shifts')
      .select('*')
      .eq('worker_id', workerProfile.id)
      .maybeSingle();

    if (data) {
      setShiftId(data.id);
      setIsOnline(data.is_online);
    }
  };

  const loadSubscriptionFromDatabase = async () => {
    try {
      setSubscriptionLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('No auth token found');
        setSubscriptionLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5001/api/subscription/get-active', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          setPremium(data.subscription.amount || 40);
          setRiskTier(data.subscription.riskTier || '🟡 Moderate');
        }
      } else if (response.status === 404) {
        // No subscription yet - use defaults
        console.log('No active subscription found, using defaults');
        setPremium(40);
        setRiskTier('🟡 Moderate');
      } else {
        console.warn('Error fetching subscription:', response.status);
      }
    } catch (err) {
      console.error('Error loading subscription:', err);
      // Use defaults on error
      setPremium(40);
      setRiskTier('🟡 Moderate');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const checkActiveDisruption = async () => {
    try {
      setDisruptionCheckLoading(true);
      const token = localStorage.getItem('authToken');

      console.log('🔍 Checking for active disruptions...');

      const response = await fetch('http://localhost:5001/api/disruption/check-active', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('📥 Disruption check response status:', response.status);

      const data = await response.json();
      console.log('📥 Disruption data:', data);

      if (response.ok && data.disruption) {
        console.log('🚨 DISRUPTION FOUND:', data.disruption);
        setActiveDisruption(data.disruption);
      } else {
        console.log('✅ No disruption found');
        setActiveDisruption(null);
      }
    } catch (err) {
      console.error('❌ Error checking disruption:', err);
    } finally {
      setDisruptionCheckLoading(false);
    }
  };

  const toggleShift = async () => {
    if (!workerProfile || !shiftId) return;

    const newStatus = !isOnline;
    
    // Update shift status
    const { error } = await supabase
      .from('active_shifts')
      .update({
        is_online: newStatus,
        shift_started_at: newStatus ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId);

    if (!error) {
      setIsOnline(newStatus);
      if (newStatus) {
        telemetry.startTelemetry(); // Start GPS streaming
      } else {
        telemetry.stopTelemetry(); // Stop GPS streaming
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex">
      {/* Left Panel */}
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Status Banner - Shows subscription & shift status */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/50 rounded-lg p-4 mb-8 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-green-400 font-semibold text-sm">✅ Shift Active • Protection Active</p>
                <p className="text-xs text-slate-400">Weekly premium: <strong className="text-green-400">₹{premium}</strong> • Risk tier: <strong>{riskTier}</strong></p>
              </div>
            </div>
          </motion.div>

          {/* Active Disruption Alert - BIG and BOLD */}
          <AnimatePresence>
            {activeDisruption && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-900/40 border-2 border-red-500 rounded-lg p-6 mb-8 flex items-start gap-4"
              >
                <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <p className="text-red-400 font-bold text-lg">🚨 ACTIVE DISRUPTION!</p>
                  <p className="text-sm text-red-300 mt-2">
                    Event Type: <strong className="text-red-200">{activeDisruption.eventType?.toUpperCase()}</strong>
                  </p>
                  <p className="text-sm text-red-300 mt-1">
                    💰 Claim Amount: <strong className="text-green-400">₹{activeDisruption.claimAmount || 500}</strong> (if verified)
                  </p>
                  <p className="text-xs text-red-400 mt-3">
                    Triggered at: {new Date(activeDisruption.triggeredAt).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Minimal Status Grid - Only Shift & Premium */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-2xl">
            {/* Shift Status */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800/70 transition"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm font-semibold">SHIFT STATUS</span>
                <Power
                  className={`w-5 h-5 ${isOnline ? 'text-green-500' : 'text-slate-500'}`}
                />
              </div>
              <p className="text-3xl font-bold text-white mb-4">
                {isOnline ? '🟢 Online' : '🔴 Offline'}
              </p>
              <button
                onClick={toggleShift}
                className={`w-full py-3 rounded-lg font-semibold transition text-white ${
                  isOnline
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isOnline ? 'Go Offline' : 'Start Shift'}
              </button>
            </motion.div>

            {/* Weekly Premium */}
            <motion.div
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800/70 transition"
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm font-semibold">WEEKLY PREMIUM</span>
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-green-400 mb-2">₹{premium}</p>
              <p className="text-sm text-slate-400">{riskTier}</p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
