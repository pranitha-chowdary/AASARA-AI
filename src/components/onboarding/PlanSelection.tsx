import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, AlertCircle, CheckCircle, Zap, Shield, BrainCircuit, CloudLightning, Users, TrendingUp, Settings } from 'lucide-react';

interface PlanSelectionProps {
  userId: string;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function PlanSelection({ userId, onSuccess }: PlanSelectionProps) {
  const [premiumData, setPremiumData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    calculatePremium();
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const calculatePremium = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('authToken');
      
      console.log('🔍 DEBUG: Token from localStorage:', token ? 'Present ✓' : 'Missing ✗');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }

      console.log('📡 DEBUG: Sending request to calculate-premium endpoint...');
      
      const response = await fetch('http://localhost:5001/api/subscription/calculate-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
        }),
      });

      console.log('📥 DEBUG: Response status:', response.status, response.statusText);
      
      if (response.ok) {
      
        const data = await response.json();
        console.log('✅ DEBUG: Premium data received:', data);
        setPremiumData(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ DEBUG: Server error response:', errorData);
        setError(
          errorData.error || 
          `Server error: ${response.status} ${response.statusText}. Make sure the backend server is running on port 5001.`
        );
      }
    } catch (err: any) {
      console.error('❌ DEBUG: Fetch error:', err);
      setError(`Connection error: ${err.message}. Is the backend server running on port 5001?`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!premiumData) return;

    setCreatingOrder(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const orderResponse = await fetch('http://localhost:5001/api/subscription/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: premiumData.prorataAmount,
          weekStart: premiumData.weekStart,
          weekEnd: premiumData.weekEnd,
          riskTier: premiumData.riskTier,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderResponse.json();

      // Open Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('http://localhost:5001/api/subscription/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
              }),
            });

            if (verifyResponse.ok) {
              onSuccess();
            }
          } catch (err) {
            setError('Payment verification failed');
          }
        },
        prefill: {
          method: 'upi',
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center text-slate-400">Loading premium calculation...</div>
      </motion.div>
    );
  }

  if (!premiumData) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center text-slate-400">Error loading premium</div>
      </motion.div>
    );
  }

  const weekStart = new Date(premiumData.weekStart);
  const weekEnd = new Date(premiumData.weekEnd);

  // Generate calendar days for the week
  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    daysOfWeek.push(date);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8 shadow-xl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <BrainCircuit className="w-8 h-8 text-blue-500" />
          <h2 className="text-3xl font-bold text-white tracking-tight">AI-Powered Risk Assessment</h2>
        </div>
        <p className="text-slate-400 mb-8 border-b border-slate-800 pb-4 text-lg">
          Predictive risk modeling specific to <span className="font-semibold text-blue-400">Food Delivery Worker</span> persona.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* AI Assessment Factors */}
          <div className="space-y-6">
            <h3 className="font-semibold text-white flex items-center gap-2 text-xl">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              Dynamic Risk Factors
            </h3>

            {/* Environmental Factors */}
            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <CloudLightning className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-slate-200 font-medium text-lg">Environmental</h4>
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/20">
                      {premiumData.factors.weatherRisk}% Risk
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Live tracking: Extreme heat, Heavy rain, Floods, Severe Pollution</p>
                  
                  <div className="w-full h-2 by-slate-700 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((premiumData.factors.weatherRisk / 50) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Factors */}
            <div className="bg-slate-800/40 rounded-xl p-5 border border-slate-700/50 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-slate-200 font-medium text-lg">Social & Locality</h4>
                    <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/20">
                      {premiumData.factors.curfewRisk + premiumData.factors.trafficRisk}% Risk
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">Live tracking: Unplanned curfews, local strikes, sudden market closures</p>
                  
                  <div className="w-full h-2 by-slate-700 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((premiumData.factors.curfewRisk + premiumData.factors.trafficRisk) / 50) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Overview Section */}
          <div className="flex flex-col">
             <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 rounded-2xl p-8 flex-1 flex flex-col justify-center relative overflow-hidden backdrop-blur-sm">
               
               {/* Decorative background glow */}
               <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"></div>

               <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-6">
                   <Calendar className="w-5 h-5 text-indigo-300" />
                   <h3 className="text-indigo-200 font-medium">Weekly Pricing Model</h3>
                 </div>

                 <div className="mb-8">
                   <p className="text-slate-400 text-sm mb-1">Dynamic Affordable Premium for this week</p>
                   <div className="flex items-baseline gap-2">
                     <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                       ₹{premiumData.prorataAmount}
                     </span>
                     <span className="text-slate-400">/ week</span>
                   </div>
                 </div>

                 <div className="space-y-4 mb-8">
                   <div className="flex items-center gap-3 text-sm text-slate-300">
                     <Settings className="w-4 h-4 text-green-400" />
                     <span>Optimized for food delivery payout cycles</span>
                   </div>
                   <div className="flex items-center gap-3 text-sm text-slate-300">
                     <Shield className="w-4 h-4 text-blue-400" />
                     <span>Active risk protection tier: <strong className="text-white">{premiumData.riskTier}</strong></span>
                   </div>
                   <div className="flex items-center gap-3 text-sm text-slate-300">
                     <CheckCircle className="w-4 h-4 text-indigo-400" />
                     <span>Valid from {weekStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} to {weekEnd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                   </div>
                 </div>

                 {error && (
                   <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 flex items-center gap-3">
                     <AlertCircle className="w-5 h-5 flex-shrink-0" />
                     <p className="text-sm">{error}</p>
                   </div>
                 )}

                 <button
                    onClick={handlePayment}
                    disabled={creatingOrder}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20 border border-blue-500/50"
                  >
                    <Zap className="w-5 h-5" />
                    {creatingOrder ? 'Processing...' : `Subscribe & Pay ₹${premiumData.prorataAmount}`}
                  </button>
               </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
