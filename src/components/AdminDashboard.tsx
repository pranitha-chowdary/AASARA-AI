import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  Users,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Calendar,
  Shield,
  CloudRain,
  Wind,
  Ban,
  Flame,
} from 'lucide-react';

interface Worker {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  platform: string;
  registeredAt: string;
  onboardingCompleted: boolean;
  subscriptionStatus: string;
  subscriptionAmount: number | null;
  riskTier: string | null;
  subscriptionEnd: string | null;
  policyActive: boolean;
}

interface AdminDashboardProps {
  // Props removed - logout handled by parent Dashboard
}

export function AdminDashboard() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [disruptionType, setDisruptionType] = useState<string>('');
  const [disruptionLoading, setDisruptionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const disruptionOptions = [
    { value: 'monsoon', label: '🌧️ Monsoon Alert', icon: CloudRain, color: 'from-blue-600 to-cyan-600' },
    { value: 'heatwave', label: '🔥 Heatwave', icon: Flame, color: 'from-orange-600 to-red-600' },
    { value: 'curfew', label: '🚨 Curfew', icon: AlertTriangle, color: 'from-red-600 to-pink-600' },
    { value: 'pollution', label: '💨 Severe Pollution', icon: Wind, color: 'from-amber-600 to-orange-600' },
    { value: 'strike', label: '⛔ Local Strike', icon: Ban, color: 'from-purple-600 to-pink-600' },
  ];

  // Fetch all workers on mount
  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');

      const response = await fetch('http://localhost:5001/api/admin/workers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workers');
      }

      const data = await response.json();
      setWorkers(data.workers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load workers');
      console.error('Fetch workers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDisruption = async () => {
    if (!selectedWorker || !disruptionType) return;

    try {
      setDisruptionLoading(true);
      const token = localStorage.getItem('adminToken');

      const response = await fetch('http://localhost:5001/api/admin/trigger-disruption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          disruptionType,
          severity: 3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger disruption');
      }

      const data = await response.json();
      setSuccessMessage(`✅ ${data.message}`);
      setDisruptionType('');
      setSelectedWorker(null);

      setTimeout(() => {
        setSuccessMessage(null);
        fetchWorkers();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger disruption');
    } finally {
      setDisruptionLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6 flex items-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
              <p className="text-green-400 font-semibold">{successMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 flex items-center gap-3"
          >
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Worker Count Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-700/50 rounded-lg p-6 mb-8"
        >
          <div className="flex items-center gap-4">
            <Users className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-purple-300 text-sm">Total Enrolled Workers</p>
              <p className="text-4xl font-bold text-white">{workers.length}</p>
            </div>
          </div>
        </motion.div>

        {/* Workers Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-blue-400">Loading workers...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {workers.map((worker, idx) => (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500/50 transition-all"
                >
                  {/* Worker Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1">{worker.fullName}</h3>
                    <p className="text-xs text-slate-400">{worker.email}</p>
                  </div>

                  {/* Worker Status */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Platform:</span>
                      <span className="text-slate-200 font-semibold">{worker.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Onboarding:</span>
                      <span className={worker.onboardingCompleted ? 'text-green-400' : 'text-yellow-400'}>
                        {worker.onboardingCompleted ? '✓ Complete' : '⏳ Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Subscription:</span>
                      <span className={worker.subscriptionStatus === 'active' ? 'text-green-400' : 'text-slate-400'}>
                        {worker.subscriptionStatus === 'active' ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </div>
                    {worker.subscriptionAmount && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Premium:</span>
                        <span className="text-green-400 font-semibold">₹{worker.subscriptionAmount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Risk Tier:</span>
                      <span className="text-amber-400">{worker.riskTier || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Currently:</span>
                      <span className={worker.policyActive ? 'text-green-400' : 'text-slate-500'}>
                        {worker.policyActive ? '🟢 Online' : '🔴 Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Trigger Disruption Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedWorker(worker)}
                    disabled={!worker.policyActive || worker.subscriptionStatus !== 'active'}
                    className={`w-full py-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                      worker.policyActive && worker.subscriptionStatus === 'active'
                        ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    Trigger Disruption
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Disruption Modal */}
        <AnimatePresence>
          {selectedWorker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWorker(null)}
              className="fixed inset-0 bg-black/50"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedWorker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-50"
            >
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Trigger Disruption</h2>
                  <p className="text-slate-400">
                    <strong>{selectedWorker.fullName}</strong> is currently online.
                  </p>
                </div>

                {/* Disruption Options */}
                <div className="space-y-2">
                  <p className="text-slate-300 text-sm font-semibold">Select Disruption Type:</p>
                  <div className="grid grid-cols-1 gap-2">
                    {disruptionOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDisruptionType(option.value)}
                        className={`p-3 rounded-lg font-semibold transition-all text-sm flex items-center gap-2 ${
                          disruptionType === option.value
                            ? `bg-gradient-to-r ${option.color} text-white`
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <option.icon className="w-4 h-4" />
                        {option.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedWorker(null);
                      setDisruptionType('');
                    }}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleTriggerDisruption}
                    disabled={!disruptionType || disruptionLoading}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {disruptionLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Triggering...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Trigger Now
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
