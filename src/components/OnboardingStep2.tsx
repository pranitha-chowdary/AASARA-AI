import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, AlertTriangle, CheckCircle2, Loader2, Shield, Zap, CloudLightning, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingStep2Props {
  onComplete: () => void;
  onBack: () => void;
}

export function OnboardingStep2({ onComplete, onBack }: OnboardingStep2Props) {
  // Dynamic week dates that update daily
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');
  const [daysOfWeek, setDaysOfWeek] = useState<Date[]>([]);
  
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  // Calculate dates dynamically - updates every time component renders
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    setWeekStart(today.toISOString().split('T')[0]);
    setWeekEnd(weekEnd.toISOString().split('T')[0]);

    // Generate calendar days
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    setDaysOfWeek(days);

    // Fetch quote when dates change
    if (user) {
      fetchAutoCalculatedQuote(today.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]);
    }
  }, [user]);

  async function fetchAutoCalculatedQuote(start: string, end: string) {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setError('Authentication required. Please sign in again.');
        setLoading(false);
        return;
      }

      console.log('📡 AUTO-CALCULATING unified premium model for:', { start, end });
      
      const response = await fetch('http://localhost:5001/api/onboarding/premium-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          weatherRisk: 'auto',
          disruptionRisk: 'auto',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to calculate premium');
      }
      
      const data = await response.json();
      console.log('✅ ONE unified model calculated:', data);
      setQuote(data);
    } catch (err: any) {
      console.error('❌ Error:', err.message);
      setError(err.message || 'Failed to calculate premium. Ensure backend is running on port 5001.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!quote) return;

    setPaying(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');

      const orderResponse = await fetch('http://localhost:5001/api/onboarding/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: quote.totalAmount,
          plan: {
            startDate: weekStart,
            endDate: weekEnd,
            riskTier: quote.riskTier,
          },
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || 'Failed to create order');
      }
      const orderData = await orderResponse.json();

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: 'INR',
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('http://localhost:5001/api/onboarding/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planDetails: {
                  startDate: weekStart,
                  endDate: weekEnd,
                  amount: quote.totalAmount,
                  days: quote.days,
                  platform: user?.platform || 'unknown',
                  riskTier: quote.riskTier,
                },
              }),
            });

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(errorData.error || 'Payment verification failed');
            }

            // Backend automatically saved subscription to MongoDB
            // No need to save to localStorage - always fetch from database
            setSuccess(true);
            setTimeout(() => {
              onComplete();
            }, 2000);
          } catch (err: any) {
            setError(`Verification failed: ${err.message}`);
            setPaying(false);
          }
        },
        prefill: {
          name: user?.fullName || 'Delivery Partner',
          email: user?.email || '',
          contact: user?.phoneNumber || '',
        },
        notes: {
          weekStart,
          weekEnd,
          riskTier: quote.riskTier,
        },
        theme: {
          color: '#3B82F6',
        },
      };

      const razorpayWindow = (window as any).Razorpay;
      if (!razorpayWindow) {
        throw new Error('Razorpay not loaded. Please refresh and try again.');
      }

      const rzp = new razorpayWindow(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-green-900/20 border border-green-700 rounded-lg p-8 text-center"
      >
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-400 mb-2">✅ Subscription Activated!</h2>
        <p className="text-slate-300">Your protection plan is now active. Redirecting to dashboard...</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-6 text-white"
      >
        <h2 className="text-2xl font-bold mb-2">✨ Your Personalized Protection Plan</h2>
        <p className="text-blue-100">
          AI-powered risk analysis generates ONE unified model for affordable weekly protection tailored to your delivery zone.
        </p>
      </motion.div>

      {/* Step Progress */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1 bg-blue-600 h-2 rounded-full"></div>
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
        <div className="flex-1 bg-blue-600 h-2 rounded-full mx-2"></div>
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
      </div>

      {/* Calendar - Week Overview */}
      {daysOfWeek.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-800/50 border border-slate-700 rounded-lg p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            This Week's Coverage
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((date, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="text-center"
              >
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                </div>
                <div className="w-full h-10 bg-blue-600/30 border-2 border-blue-500 rounded-lg flex items-center justify-center text-sm font-bold text-blue-300">
                  {date.getDate()}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            Coverage: {new Date(weekStart).toLocaleDateString()} → {new Date(weekEnd).toLocaleDateString()}
          </p>
        </motion.div>
      )}

      {/* Single Unified Protection Model */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-800 border border-slate-700 rounded-lg p-8 flex items-center justify-center gap-3"
        >
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-slate-300">Calculating your personalized protection model...</span>
        </motion.div>
      ) : quote ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-indigo-900/30 to-blue-900/30 border-2 border-blue-500/50 rounded-xl p-8 space-y-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                <Shield className="w-7 h-7 text-green-400" />
                {quote.riskTier}
              </h2>
              <p className="text-slate-300">7-day comprehensive protection</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-green-400 mb-2">₹{quote.totalAmount}</div>
              <p className="text-slate-400 text-sm">Total for 7 days</p>
            </div>
          </div>

          {/* Weekly Affordability Metrics */}
          {quote.affordability && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">💰</div>
                <div className="flex-1">
                  <p className="font-semibold text-green-400 mb-1">{quote.affordability.message}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                    <div>
                      <p className="text-slate-500 text-xs">Expected Weekly Earnings</p>
                      <p className="font-bold text-lg">₹{quote.affordability.typicalWeeklyEarnings}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Premium as % of Earnings</p>
                      <p className="font-bold text-lg text-green-400">{quote.affordability.premiumAsPercentage}%</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 border-t border-slate-700 pt-3">
                ✓ This weekly plan aligns with your typical payout cycle from {user?.platform || 'delivery platform'}
              </p>
            </motion.div>
          )}

          {/* Risk Analysis Summary */}
          <div className="grid grid-cols-3 gap-4 bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <CloudLightning className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400">{quote.weatherRiskPoints || 0}</div>
              <p className="text-xs text-slate-400 mt-1">Environmental</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-purple-400">{quote.disruptionRiskPoints || 0}</div>
              <p className="text-xs text-slate-400 mt-1">Social & Locality</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-yellow-400">{quote.days}</div>
              <p className="text-xs text-slate-400 mt-1">Coverage Days</p>
            </div>
          </div>

          {/* Pricing Breakdown - Weekly Model */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 space-y-3 text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-600">
              <span className="text-slate-400 flex items-center gap-2">
                <span>📅 Weekly Protection Plan</span>
              </span>
              <span className="font-bold text-lg text-green-400">₹{quote.weeklyPremium}/week</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Base Premium</span>
                <span className="font-semibold">₹{quote.basePremiumPerDay}/day</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Weather Risk Multiplier</span>
                <span className="font-semibold text-blue-400">×{quote.breakdown.weatherMultiplier}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Disruption Risk Multiplier</span>
                <span className="font-semibold text-orange-400">×{quote.breakdown.disruptionMultiplier}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-600">
                <span className="font-semibold">Daily Cost</span>
                <span className="font-bold text-yellow-400">₹{quote.dailyPremium}/day</span>
              </div>
            </div>

            <div className="bg-slate-800 rounded p-3 text-xs text-slate-300 font-mono">
              <p className="mb-1">Formula:</p>
              <p>{quote.breakdown.formula}</p>
            </div>

            <div className="flex justify-between text-white font-bold text-base">
              <span>Your Weekly Total</span>
              <span className="text-green-400">₹{quote.totalAmount}</span>
            </div>
          </div>

          {/* What's Covered */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <strong className="text-blue-300">✓ Protected against:</strong> Extreme heat • Heavy rain • Floods • Severe pollution • Curfews • Local strikes • Zone closures • Traffic disruptions
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {/* Subscribe Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePayment}
            disabled={paying}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/50"
          >
            {paying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Subscribe Now & Pay ₹{quote.totalAmount}
              </>
            )}
          </motion.button>

          {/* Back Button */}
          <button
            onClick={onBack}
            disabled={paying}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-medium rounded-lg transition-colors"
          >
            ← Back
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}
