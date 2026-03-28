import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTelemetryService } from '../services/telemetryService';

const GATEWAY_URL = 'http://localhost:5001';

export function RealTimeDashboard() {
  const { workerProfile } = useAuth();
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
  const [claimsHistory, setClaimsHistory] = useState<any[]>([]);

  useEffect(() => {
    loadShiftStatus();
    loadSubscriptionFromDatabase();
    checkActiveDisruption();
    fetchClaimsHistory();
    
    // Check for disruptions and claims every 5 seconds
    const interval = setInterval(() => {
      checkActiveDisruption();
      fetchClaimsHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [workerProfile]);

  const fetchClaimsHistory = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${GATEWAY_URL}/api/claims/my-claims`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClaimsHistory(data.claims || []);
      }
    } catch (e) { console.error('Error fetching personal claims', e); }
  };

  const loadShiftStatus = async () => {
    if (!workerProfile) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${GATEWAY_URL}/api/shifts/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.shift) {
          setShiftId(data.shift.shiftId || data.shift._id);
          setIsOnline(data.shift.status === 'active');
        }
      }
    } catch (err) {
      console.error('Error loading shift status:', err);
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
    if (!workerProfile) return;

    const newStatus = !isOnline;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${GATEWAY_URL}/api/shifts/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOnline: newStatus }),
      });

      if (response.ok) {
        setIsOnline(newStatus);
        if (newStatus) {
          telemetry.startTelemetry(); // Start GPS streaming
        } else {
          telemetry.stopTelemetry(); // Stop GPS streaming
        }
      }
    } catch (err) {
      console.error('Error toggling shift:', err);
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
                className={`border-2 rounded-lg p-6 mb-8 flex items-start gap-4 ${
                  activeDisruption.status === 'paid' ? 'bg-green-900/40 border-green-500' :
                  activeDisruption.status === 'micro_verify' ? 'bg-yellow-900/40 border-yellow-500' :
                  activeDisruption.status === 'rejected' ? 'bg-red-900/40 border-red-500' :
                  'bg-blue-900/40 border-blue-500'
                }`}
              >
                {activeDisruption.status === 'paid' ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0 mt-0.5" />
                ) : activeDisruption.status === 'micro_verify' ? (
                  <ShieldAlert className="w-8 h-8 text-yellow-500 flex-shrink-0 mt-0.5 animate-pulse" />
                ) : activeDisruption.status === 'rejected' ? (
                  <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-8 h-8 text-blue-500 flex-shrink-0 mt-0.5 animate-pulse" />
                )}
                
                <div className="flex-1">
                  <p className={`font-bold text-lg ${
                    activeDisruption.status === 'paid' ? 'text-green-400' :
                    activeDisruption.status === 'micro_verify' ? 'text-yellow-400' :
                    activeDisruption.status === 'rejected' ? 'text-red-400' :
                    'text-blue-400'
                  }`}>
                    {activeDisruption.status === 'paid' ? '💰 CLAIM PAID INSTANTLY!' :
                     activeDisruption.status === 'micro_verify' ? '📸 VERIFICATION NEEDED' :
                     activeDisruption.status === 'rejected' ? '🚫 CLAIM REJECTED' :
                     '⌛ PROCESSING CLAIM...'}
                  </p>
                  
                  <p className="text-sm text-slate-300 mt-2">
                    Event Type: <strong className="text-white">{activeDisruption.eventType?.toUpperCase()}</strong>
                  </p>
                  
                  <p className="text-sm text-slate-300 mt-1">
                    Amount: <strong className={activeDisruption.status === 'paid' ? 'text-green-400' : 'text-slate-200'}>
                      ₹{activeDisruption.claimAmount || 500}
                    </strong>
                  </p>

                  <p className="text-sm text-slate-300 mt-2 p-3 bg-slate-900/50 rounded-lg">
                    {activeDisruption.status === 'paid' ? 'Your claim has been verified by our Zero-Trust ML Engine and payout has been credited to your account.' :
                     activeDisruption.status === 'micro_verify' ? 'Our system detected an anomaly. Please upload a timestamped photo of the disruption to proceed.' :
                     activeDisruption.status === 'rejected' ? 'Your claim was flagged for fraud and rejected after administrative review.' :
                     'Your disruption is being analyzed by our verification engine. Please wait.'}
                  </p>
                  
                  <p className="text-xs text-slate-500 mt-3">
                    Triggered at: {new Date(activeDisruption.triggeredAt).toLocaleTimeString()}
                  </p>

                  {activeDisruption.status === 'micro_verify' && (
                    <button className="mt-4 w-full py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-yellow-900/20">
                      Upload Photo Evidence
                    </button>
                  )}
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

          {/* User Claims Pipeline */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden mt-8">
            <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                📄 My Claims Pipeline
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-4 font-semibold">Event Type</th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Triggered By</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {claimsHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No claims in your history yet.
                      </td>
                    </tr>
                  ) : claimsHistory.map((claim) => (
                    <tr key={claim._id} className="hover:bg-slate-800/50 transition">
                      <td className="p-4">
                        <span className="font-medium text-slate-200 capitalize">
                          {claim.disruptionType || claim.eventType || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-green-400">₹{claim.amount}</td>
                      <td className="p-4 text-slate-400 text-xs">
                        {claim.triggerSource === 'admin' ? 'Manual (Admin)' : 'Auto-Trigger System'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          claim.status === 'paid' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          claim.status === 'micro_verify' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          claim.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {claim.status === 'paid' ? '💰 Paid' : 
                           claim.status === 'micro_verify' ? '📸 Verify' : 
                           claim.status === 'rejected' ? '🚫 Rejected' : 'Processing'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-xs text-right whitespace-nowrap">
                        {new Date(claim.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
