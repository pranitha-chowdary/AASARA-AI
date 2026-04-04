import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, Loader2, Shield, Zap,
  CloudLightning, MapPin, Droplets, Wind,
  Brain, TrendingDown, Clock, Eye, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OnboardingStep2Props {
  onComplete: () => void;
  onBack: () => void;
}

export function OnboardingStep2({ onComplete, onBack }: OnboardingStep2Props) {
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('basic');

  // Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('detecting');
  const [analysisStep, setAnalysisStep] = useState<string>('');

  useEffect(() => {
    requestGeolocation();
  }, []);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEndDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
    setWeekStart(today.toISOString().split('T')[0]);
    setWeekEnd(weekEndDate.toISOString().split('T')[0]);
    if (user && userLocation) {
      fetchMLPremiumQuote(
        today.toISOString().split('T')[0],
        weekEndDate.toISOString().split('T')[0],
        userLocation.lat,
        userLocation.lng
      );
    }
  }, [user, userLocation]);

  function requestGeolocation() {
    setLocationStatus('detecting');
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setUserLocation({ lat: 17.385, lng: 78.4867 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('detected');
      },
      () => {
        setLocationStatus('denied');
        setUserLocation({ lat: 17.385, lng: 78.4867 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function fetchMLPremiumQuote(start: string, end: string, lat: number, lng: number) {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      if (!token) { setError('Authentication required.'); setLoading(false); return; }

      setAnalysisStep('📡 Detecting your location...');
      await delay(500);
      setAnalysisStep('🌤️ Fetching 7-day weather forecast...');
      await delay(700);
      setAnalysisStep('🏘️ Analyzing zone safety...');
      await delay(600);
      setAnalysisStep('⚡ Predicting disruption patterns...');
      await delay(500);
      setAnalysisStep('🧠 ML Model calculating both plan quotes...');

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/onboarding/premium-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startDate: start, endDate: end, lat, lng }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to calculate premium');
      }

      const data = await response.json();
      setAnalysisStep('✅ Analysis complete!');
      await delay(400);
      setQuote(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load premium quotes.');
    } finally {
      setLoading(false);
    }
  }

  function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  const currentPlanData = quote?.plans?.[selectedPlan];
  const payAmount = currentPlanData?.totalAmount || (selectedPlan === 'premium' ? 49 : 28);

  async function handlePayment() {
    if (!quote) return;
    setPaying(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const orderResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/onboarding/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: payAmount,
          plan: { startDate: weekStart, endDate: weekEnd, riskTier: currentPlanData?.risk_tier, planType: selectedPlan },
        }),
      });
      if (!orderResponse.ok) { const e = await orderResponse.json(); throw new Error(e.error || 'Failed to create order'); }
      const orderData = await orderResponse.json();

      const options = {
        key: orderData.key, amount: orderData.amount, currency: 'INR', order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/onboarding/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                orderId: orderData.orderId, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature,
                planDetails: { startDate: weekStart, endDate: weekEnd, amount: payAmount, days: quote.days,
                  platform: (user as any)?.platform || 'unknown', riskTier: currentPlanData?.risk_tier, planType: selectedPlan },
              }),
            });
            if (!verifyResponse.ok) { const e = await verifyResponse.json(); throw new Error(e.error || 'Verification failed'); }
            setSuccess(true);
            setTimeout(() => onComplete(), 2000);
          } catch (err: any) { setError(`Verification failed: ${err.message}`); setPaying(false); }
        },
        prefill: { name: user?.fullName || '', email: user?.email || '', contact: (user as any)?.phoneNumber || '' },
        theme: { color: selectedPlan === 'premium' ? '#8B5CF6' : '#3B82F6' },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) { setError(err.message); setPaying(false); }
  }

  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-green-700 mb-2">✅ Subscription Activated!</h2>
        <p className="text-slate-600">Your {selectedPlan === 'premium' ? 'Total Guard' : 'Basic Shield'} plan is now active.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 via-teal-600 to-teal-500 rounded-xl p-6 text-white relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-6 h-6" />
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">AI-Powered</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Choose Your Protection Plan</h2>
          <p className="text-teal-50 text-sm">
            Two affordable plans — powered by ML risk analysis of your zone's weather, traffic & disruption data.
          </p>
        </div>
      </motion.div>

      {/* Location Card — Prominent */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-4 space-y-3 ${
          locationStatus === 'detected' ? 'bg-green-50 border-green-200'
            : locationStatus === 'denied' ? 'bg-amber-50 border-amber-200'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              locationStatus === 'detected' ? 'bg-green-100' : 'bg-teal-50'
            }`}>
              <MapPin className={`w-4 h-4 ${locationStatus === 'detected' ? 'text-green-600' : 'text-teal-600'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {locationStatus === 'detecting' && '📡 Detecting Your Location...'}
                {locationStatus === 'detected' && '📍 Location Detected'}
                {locationStatus === 'denied' && '📍 Location Permission Denied'}
                {locationStatus === 'unavailable' && '📍 Geolocation Unavailable'}
              </p>
              {userLocation && (
                <p className="text-xs text-slate-500 font-mono">
                  {userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E
                </p>
              )}
            </div>
          </div>
          {quote?.zoneSafety?.detected_city && (
            <div className="text-right">
              <span className="text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-lg">
                🏙️ {quote.zoneSafety.detected_city}
              </span>
            </div>
          )}
        </div>

        {/* Zone Safety Mini-Display */}
        {quote?.zoneSafety && (
          <div className="flex items-center gap-4 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <div className={`text-lg font-bold ${
                quote.zoneSafety.safety_score >= 70 ? 'text-green-600' : 'text-orange-600'
              }`}>
                {quote.zoneSafety.safety_score}/100
              </div>
              <span className="text-xs text-slate-500">Zone Safety</span>
            </div>
            <div className="h-6 w-px bg-slate-300" />
            <div className="text-xs text-slate-600">
              {quote.zoneSafety.is_safe_zone
                ? <span className="text-green-700">✅ Safe zone — eligible for discounts</span>
                : <span className="text-orange-600">⚠️ Higher risk zone — enhanced coverage recommended</span>
              }
            </div>
          </div>
        )}

        {/* Nearby risk zones */}
        {quote?.zoneSafety?.risk_breakdown?.waterlogging?.nearby_zones?.length > 0 && (
          <div className="text-xs text-slate-500 pt-1">
            ⚡ Nearby risk zones: {quote.zoneSafety.risk_breakdown.waterlogging.nearby_zones.map(
              (z: any) => `${z.name} (${z.distance_km}km)`
            ).join(', ')}
          </div>
        )}
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-16 h-16 mx-auto">
              <Brain className="w-16 h-16 text-purple-600" />
            </motion.div>
            <h3 className="text-xl font-bold text-slate-800">AI Risk Analysis</h3>
            <motion.p key={analysisStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="text-purple-700 text-sm font-medium">{analysisStep}</motion.p>
          </div>
          <div className="space-y-3">
            {['Weather Forecast', 'Zone Safety', 'Disruption Patterns', 'Plan Quotes'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-32 text-xs text-slate-500">{step}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <motion.div initial={{ width: 0 }} animate={{ width: '100%' }}
                    transition={{ delay: i * 0.7, duration: 0.7, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-purple-500 to-teal-500 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {quote && !loading && (
        <div className="space-y-6">

          {/* ========== PLAN SELECTION CARDS ========== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BASIC SHIELD */}
            <motion.button
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlan('basic')}
              className={`relative text-left rounded-xl border-2 p-5 transition-all ${
                selectedPlan === 'basic'
                  ? 'border-teal-500 bg-teal-50 shadow-lg shadow-teal-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}>
              {selectedPlan === 'basic' && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 bg-teal-500 rounded-full p-1">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </motion.div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-6 h-6 text-teal-600" />
                <h3 className="text-lg font-bold text-slate-800">
                  {quote.plans?.basic?.plan_emoji || '🛡️'} {quote.plans?.basic?.plan_name || 'Basic Shield'}
                </h3>
              </div>
              <p className="text-slate-500 text-xs mb-3">{quote.plans?.basic?.plan_tagline || 'Essential protection'}</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-teal-600">₹{quote.plans?.basic?.totalAmount || 28}</span>
                <span className="text-slate-500 text-sm">/ week</span>
                <span className="text-slate-400 text-xs ml-1">(₹{quote.plans?.basic?.daily_premium || 4}/day)</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>{quote.plans?.basic?.dynamic_coverage?.total_hours || 8}h daily coverage</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Zap className="w-3.5 h-3.5 text-teal-600" />
                  <span>Up to ₹{quote.plans?.basic?.max_claim_payout || 500} per claim</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>{quote.plans?.basic?.claim_processing || '24 hours'} processing</span>
                </div>
              </div>
              {/* Covers */}
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                {(quote.plans?.basic?.covers || []).map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" /><span>{c}</span>
                  </div>
                ))}
                {(quote.plans?.basic?.does_not_cover || []).slice(0, 2).map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-3 h-3 text-center">✕</span><span className="line-through">{c}</span>
                  </div>
                ))}
              </div>
            </motion.button>

            {/* TOTAL GUARD (PREMIUM) */}
            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlan('premium')}
              className={`relative text-left rounded-xl border-2 p-5 transition-all ${
                selectedPlan === 'premium'
                  ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}>
              {/* Popular badge */}
              <div className="absolute -top-3 left-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-0.5 rounded-full shadow-sm">
                ⭐ RECOMMENDED
              </div>
              {selectedPlan === 'premium' && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 bg-purple-500 rounded-full p-1">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </motion.div>
              )}
              <div className="flex items-center gap-2 mb-3 mt-1">
                <Zap className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-800">
                  {quote.plans?.premium?.plan_emoji || '⚡'} {quote.plans?.premium?.plan_name || 'Total Guard'}
                </h3>
              </div>
              <p className="text-slate-500 text-xs mb-3">{quote.plans?.premium?.plan_tagline || 'Complete AI-powered protection'}</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-purple-600">₹{quote.plans?.premium?.totalAmount || 49}</span>
                <span className="text-slate-500 text-sm">/ week</span>
                <span className="text-slate-400 text-xs ml-1">(₹{quote.plans?.premium?.daily_premium || 7}/day)</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>{quote.plans?.premium?.dynamic_coverage?.total_hours || 16}h daily coverage</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Zap className="w-3.5 h-3.5 text-purple-600" />
                  <span>Up to ₹{quote.plans?.premium?.max_claim_payout || 1500} per claim</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  <span>{quote.plans?.premium?.claim_processing || 'Instant'} processing</span>
                </div>
                {quote.plans?.premium?.zone_discount?.applied && (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Zone discount: -₹{quote.plans?.premium?.zone_discount?.amount_per_week}/wk</span>
                  </div>
                )}
                {quote.plans?.premium?.dynamic_coverage?.bonus_hours > 0 && (
                  <div className="flex items-center gap-2 text-teal-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>+{quote.plans?.premium?.dynamic_coverage?.bonus_hours}h bonus coverage</span>
                  </div>
                )}
              </div>
              {/* Covers */}
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                {(quote.plans?.premium?.covers || []).map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" /><span>{c}</span>
                  </div>
                ))}
              </div>
            </motion.button>
          </div>

          {/* Liquidity Pool Info */}
          {currentPlanData?.liquidity_pool && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
              <Users className="w-6 h-6 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-teal-700 font-semibold text-sm">🏦 Community Liquidity Pool</p>
                <p className="text-xs text-slate-600 mt-1">
                  {currentPlanData.liquidity_pool.message}. As more workers join, the pool grows —  
                  enabling instant automatic payouts when disruptions hit.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Pool share: {currentPlanData.liquidity_pool.pool_share} of your ₹{currentPlanData.weekly_premium}/week premium
                </p>
              </div>
            </motion.div>
          )}

          {/* Plan Comparison Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 text-slate-600 font-normal">Feature</th>
                  <th className="p-3 text-teal-600 font-semibold text-center">🛡️ Basic</th>
                  <th className="p-3 text-purple-600 font-semibold text-center">⚡ Total Guard</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  ['Weekly Cost', `₹${quote.plans?.basic?.weekly_premium || 28}`, `₹${quote.plans?.premium?.weekly_premium || 49}`],
                  ['Daily Cost', `₹${quote.plans?.basic?.daily_premium || 4}`, `₹${quote.plans?.premium?.daily_premium || 7}`],
                  ['Coverage Hours', `${quote.plans?.basic?.dynamic_coverage?.total_hours || 8}h/day`, `${quote.plans?.premium?.dynamic_coverage?.total_hours || 16}h/day`],
                  ['Max Claim', `₹${quote.plans?.basic?.max_claim_payout || 500}`, `₹${quote.plans?.premium?.max_claim_payout || 1500}`],
                  ['Claim Speed', quote.plans?.basic?.claim_processing || '24h', quote.plans?.premium?.claim_processing || 'Instant'],
                  ['Flood/Rain', '✅', '✅'],
                  ['Extreme Heat', '✅', '✅'],
                  ['Curfews', '❌', '✅'],
                  ['Strikes', '❌', '✅'],
                  ['Traffic Disruptions', '❌', '✅'],
                  ['Zone Discount', '❌', quote.plans?.premium?.zone_discount?.applied ? '✅ Active' : '✅ Eligible'],
                  ['Bonus Coverage', '❌', quote.plans?.premium?.dynamic_coverage?.bonus_hours > 0 ? `+${quote.plans.premium.dynamic_coverage.bonus_hours}h` : '✅ Eligible'],
                  ['Priority Support', '❌', '✅'],
                ].map(([feature, basic, premium], i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="p-2.5 text-slate-700">{feature}</td>
                    <td className="p-2.5 text-center text-slate-800 font-medium">{basic}</td>
                    <td className="p-2.5 text-center text-slate-800 font-medium">{premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Weather Forecast */}
          {quote.weatherForecast && quote.weatherForecast.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-3">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <CloudLightning className="w-5 h-5 text-teal-500" />
                Weather Forecast
                {quote.currentWeather?.city && (
                  <span className="text-xs text-slate-500 font-normal ml-auto">📍 {quote.currentWeather.city}</span>
                )}
              </h3>
              {quote.currentWeather && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{Math.round(quote.currentWeather.temperature || 0)}°C</p>
                    <p className="text-xs text-slate-500 capitalize">{quote.currentWeather.weather_description || ''}</p>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <Droplets className="w-3.5 h-3.5 text-teal-500 mx-auto mb-0.5" />
                      <p className="text-slate-600">{Math.round(quote.currentWeather.humidity || 0)}%</p>
                    </div>
                    <div>
                      <Wind className="w-3.5 h-3.5 text-teal-400 mx-auto mb-0.5" />
                      <p className="text-slate-600">{Math.round(quote.currentWeather.wind_speed || 0)} m/s</p>
                    </div>
                    <div>
                      <Eye className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
                      <p className="text-slate-600">{Math.round((quote.currentWeather.visibility || 10000) / 1000)} km</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-5 gap-2">
                {quote.weatherForecast.slice(0, 5).map((day: any, idx: number) => (
                  <motion.div key={day.date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-sm">
                    <p className="text-xs text-slate-500 mb-1">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</p>
                    <p className="text-base mb-0.5">
                      {day.dominant_weather === 'Rain' ? '🌧️' : day.dominant_weather === 'Clouds' ? '☁️'
                        : day.dominant_weather === 'Clear' ? '☀️' : day.dominant_weather === 'Thunderstorm' ? '⛈️' : '🌤️'}
                    </p>
                    <p className="text-xs text-slate-800 font-bold">{Math.round(day.temp_max)}°</p>
                    {day.rain_total_mm > 0 && <p className="text-xs text-teal-600 mt-0.5">💧{Math.round(day.rain_total_mm)}mm</p>}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Risk Analysis */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI Risk Analysis
              {quote.mlPowered && (
                <span className="text-xs text-purple-600 ml-auto font-normal">
                  GBDT v2.0 • {Math.round((currentPlanData?.confidence || 0.85) * 100)}% confidence
                </span>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <CloudLightning className="w-5 h-5 text-teal-500 mx-auto mb-1.5" />
                <div className="text-xl font-bold text-teal-600">{quote.weatherRisk?.score || 0}</div>
                <p className="text-xs text-slate-500 mt-0.5">Weather Risk</p>
                <p className="text-xs text-slate-600 font-medium">{quote.weatherRisk?.risk_level || 'N/A'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <MapPin className="w-5 h-5 text-green-500 mx-auto mb-1.5" />
                <div className={`text-xl font-bold ${(quote.zoneSafety?.safety_score || 0) >= 70 ? 'text-green-600' : 'text-orange-500'}`}>
                  {quote.zoneSafety?.safety_score || 0}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Zone Safety</p>
                <p className="text-xs text-slate-600 font-medium">{quote.zoneSafety?.is_safe_zone ? '✅ Safe' : '⚠️ At Risk'}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <Zap className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                <div className="text-xl font-bold text-amber-500">
                  {Math.round((quote.disruptionForecast?.weekly_summary?.avg_disruption_probability || 0) * 100)}%
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Disruption</p>
                <p className="text-xs text-slate-600 font-medium">{quote.disruptionForecast?.weekly_summary?.risk_level || 'N/A'}</p>
              </div>
            </div>

            {/* Disruption Timeline */}
            {quote.disruptionForecast?.daily && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2 font-semibold">DAILY DISRUPTION RISK</p>
                <div className="flex gap-1">
                  {quote.disruptionForecast.daily.slice(0, 7).map((day: any, idx: number) => {
                    const prob = day.disruption_probability || 0;
                    const h = Math.max(6, prob * 50);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-slate-200 rounded-sm relative" style={{ height: '50px' }}>
                          <motion.div initial={{ height: 0 }} animate={{ height: `${h}px` }}
                            transition={{ delay: idx * 0.08 }}
                            className={`absolute bottom-0 w-full rounded-sm ${
                              prob > 0.4 ? 'bg-red-500' : prob > 0.2 ? 'bg-orange-500' : prob > 0.1 ? 'bg-amber-400' : 'bg-green-500'
                            }`} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">{new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Affordability */}
          {quote.affordability && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-green-50 border-l-4 border-green-500 shadow-sm rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-xl">💰</div>
                <div>
                  <p className="font-semibold text-green-700 text-sm">{quote.affordability.message}</p>
                  <div className="grid grid-cols-3 gap-3 mt-2 text-xs text-slate-700">
                    <div>
                      <p className="text-slate-500">Weekly Earnings</p>
                      <p className="font-bold text-base">₹{quote.affordability.typicalWeeklyEarnings}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Basic Shield</p>
                      <p className="font-bold text-base text-teal-600">{quote.affordability.basicAsPercentage}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total Guard</p>
                      <p className="font-bold text-base text-purple-600">{quote.affordability.premiumAsPercentage}%</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {/* Subscribe Button */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handlePayment} disabled={paying}
            className={`w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
              selectedPlan === 'premium'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-purple-200'
                : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-teal-200'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}>
            {paying ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Processing...</>
            ) : (
              <>
                {selectedPlan === 'premium' ? <Zap className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                Subscribe to {currentPlanData?.plan_name || (selectedPlan === 'premium' ? 'Total Guard' : 'Basic Shield')} — ₹{payAmount}/week
              </>
            )}
          </motion.button>

          {/* Back */}
          <button onClick={onBack} disabled={paying}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-medium rounded-lg transition-colors border border-slate-200 shadow-sm">
            ← Back to Platform Linking
          </button>
        </div>
      )}
    </div>
  );
}
