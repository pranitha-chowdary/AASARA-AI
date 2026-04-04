import { useState } from 'react';
import { motion } from 'framer-motion';
import { Power, CheckCircle2, AlertCircle, Loader2, Shield, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ShiftActivationProps {
  onShiftActive: (shiftData: any) => void;
}

export function ShiftActivation({ onShiftActive }: ShiftActivationProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftActive, setShiftActive] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);
  const { user } = useAuth();

  async function activateShift() {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/shifts/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate shift');
      }

      const data = await response.json();
      setShiftData(data.shift);
      setShiftActive(true);
      onShiftActive(data.shift);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (shiftActive && shiftData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-900 to-emerald-900 rounded-lg p-6 border border-green-700"
      >
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">✅ Shift Active</h3>
            <div className="space-y-2 text-green-100">
              <p className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  Activated: {new Date(shiftData.activatedAt).toLocaleTimeString()}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>
                  Daily coverage: ₹{shiftData.subscription.premium.toFixed(2)}
                </span>
              </p>
              <p className="text-sm">
                Platform: <span className="font-semibold capitalize">{shiftData.platform}</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 rounded-lg p-6 border border-slate-700"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Ready to Start Your Shift?</h3>
          <p className="text-slate-400">Click below to activate your daily protection</p>
        </div>
        <Shield className="w-8 h-8 text-blue-400 opacity-50" />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200">{error}</p>
        </div>
      )}

      <button
        onClick={activateShift}
        disabled={loading}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <Power className="w-5 h-5" />
            Activate Today's Shift
          </>
        )}
      </button>

      <p className="text-xs text-slate-500 text-center mt-3">
        🔄 No new onboarding needed. Just activate once per day to start your coverage.
      </p>
    </motion.div>
  );
}
