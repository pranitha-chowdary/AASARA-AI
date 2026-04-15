import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import RazorpayCheckout from '../components/RazorpayCheckout';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const ANALYSIS_STEPS = [
  '📡 Detecting your location...',
  '🌤️ Fetching 7-day weather forecast...',
  '🏘️ Analyzing zone safety...',
  '⚡ Predicting disruption patterns...',
  '🧠 ML Model calculating both plan quotes...',
  '✅ Analysis complete!',
];

const OnboardingStep2Screen: React.FC<Props> = ({ onComplete, onBack }) => {
  const { user, refreshUser } = useAuth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekStart = today.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>('basic');
  const [locationStatus, setLocationStatus] = useState<'waiting_consent' | 'detecting' | 'detected' | 'denied'>('waiting_consent');

  // DPDP Act 2023 Consent
  const [consentGPS, setConsentGPS] = useState(false);
  const [consentUPI, setConsentUPI] = useState(false);
  const [consentPlatform, setConsentPlatform] = useState(false);
  const allConsentsGiven = consentGPS && consentUPI && consentPlatform;
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [analysisStep, setAnalysisStep] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  // Razorpay WebView checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    if (userLocation) fetchQuote(weekStart, weekEndStr, userLocation.lat, userLocation.lng);
  }, [userLocation]);

  const requestLocation = async () => {
    try {
      setLocationStatus('detecting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        setConsentGPS(false);
        Alert.alert('Location Permission Denied', 'Please enable location access in your device settings to use Aasara.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setUserLocation(coords);
      setLocationStatus('detected');
      setConsentGPS(true);
      // Persist GPS to backend
      try { await apiService.saveLocation(coords.lat, coords.lng); } catch {}
    } catch {
      setLocationStatus('denied');
      setConsentGPS(false);
    }
  };

  const handleGPSConsent = () => {
    if (!consentGPS) {
      // User is checking the box — request real GPS permission
      requestLocation();
    } else {
      // User is unchecking — revoke consent, clear location
      setConsentGPS(false);
      setUserLocation(null);
      setLocationStatus('waiting_consent');
    }
  };

  const fetchQuote = async (start: string, end: string, lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    setStepIndex(0);
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setAnalysisStep(ANALYSIS_STEPS[i]);
      setStepIndex(i);
      await delay(500 + i * 150);
    }
    try {
      const data = await apiService.getPremiumQuote(start, end, lat, lng);
      setQuote(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to calculate premium. Please try again.');
    } finally { setLoading(false); }
  };

  const handlePayment = async () => {
    if (!quote) return;
    const plan = quote.plans?.[selectedPlan];
    const amount = plan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28);

    setPaying(true);
    setError(null);
    try {
      // Step 1: Create Razorpay order via backend
      const order = await apiService.createOrder(amount, {
        startDate: weekStart,
        endDate: weekEndStr,
        riskTier: plan?.risk_tier || '🟡 Moderate',
        planType: selectedPlan,
      });
      setOrderData(order);
      setShowCheckout(true); // Opens the Razorpay WebView checkout
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create payment order.');
      setPaying(false);
    }
  };

  const handlePaymentSuccess = async (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setShowCheckout(false);
    setPaying(true);
    try {
      const plan = quote.plans?.[selectedPlan];
      const amount = plan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28);
      await apiService.verifyPayment(
        orderData.orderId,
        response.razorpay_payment_id,
        response.razorpay_signature,
        {
          startDate: weekStart,
          endDate: weekEndStr,
          amount,
          days: quote.days || 7,
          platform: (user as any)?.platform || 'unknown',
          riskTier: plan?.risk_tier || '🟡 Moderate',
          planType: selectedPlan,
        }
      );
      await refreshUser();
      setSuccess(true);
      setTimeout(() => onComplete(), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Payment verification failed.');
    } finally {
      setPaying(false);
    }
  };

  const handlePaymentFailure = (errorMsg: string) => {
    setShowCheckout(false);
    setPaying(false);
    setError(errorMsg || 'Payment failed. Please try again.');
  };

  const handlePaymentDismiss = () => {
    setShowCheckout(false);
    setPaying(false);
  };

  const currentPlan = quote?.plans?.[selectedPlan];

  // =============== SUCCESS SCREEN ===============
  if (success) {
    return (
      <SafeAreaView style={S.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0fdf4" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#f0fdf4' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="checkmark-circle" size={48} color="#059669" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#134e4a', marginBottom: 8 }}>Payment Confirmed!</Text>
          <Text style={{ fontSize: 15, color: '#064e3b', textAlign: 'center', marginBottom: 16 }}>
            Your {selectedPlan === 'premium' ? '⚡ Total Guard' : '🛡️ Basic Shield'} plan is enrolled.
          </Text>
          <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 16, width: '100%' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e', textAlign: 'center' }}>⏳ Coverage activates in 48 hours</Text>
            <Text style={{ fontSize: 12, color: '#b45309', textAlign: 'center', marginTop: 6 }}>
              Per Social Security Code, 2020 — a 48-hour lockout prevents adverse selection (buying insurance during an active disaster).
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#7c3aed" />

      {/* Razorpay WebView Checkout Modal */}
      {orderData && (
        <RazorpayCheckout
          visible={showCheckout}
          orderId={orderData.orderId}
          amount={orderData.amount}
          keyId={orderData.key}
          prefill={{
            name: (user as any)?.fullName || '',
            email: (user as any)?.email || '',
            contact: (user as any)?.phoneNumber || '',
          }}
          color={selectedPlan === 'premium' ? '#8B5CF6' : '#0d9488'}
          description={`Aasara ${selectedPlan === 'premium' ? 'Total Guard' : 'Basic Shield'} Weekly Plan`}
          onSuccess={handlePaymentSuccess}
          onFailure={handlePaymentFailure}
          onDismiss={handlePaymentDismiss}
        />
      )}

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* ========== HEADER BANNER ========== */}
        <View style={S.headerBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MaterialCommunityIcons name="brain" size={22} color="#fff" />
            <View style={S.aiBadge}>
              <Text style={S.aiBadgeText}>AI-POWERED</Text>
            </View>
          </View>
          <Text style={S.headerTitle}>Choose Your Protection Plan</Text>
          <Text style={S.headerSub}>
            Two affordable plans — powered by ML risk analysis of your zone's weather, traffic & disruption data.
          </Text>
        </View>

        {/* ========== PROGRESS DOTS ========== */}
        <View style={S.progress}>
          <View style={[S.progressDot, { backgroundColor: '#10b981' }]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
          <View style={[S.progressLine, { backgroundColor: '#10b981' }]} />
          <View style={[S.progressDot, { backgroundColor: '#0d9488' }]}>
            <Text style={S.progressDotText}>2</Text>
          </View>
        </View>

        {/* ========== LOCATION CARD ========== */}
        <View style={[S.locationCard,
          locationStatus === 'detected' ? { backgroundColor: '#f0fdf4', borderColor: '#86efac' }
          : { backgroundColor: '#fff', borderColor: '#e2e8f0' }
        ]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[S.locIconCircle, locationStatus === 'detected' ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#f0fdfa' }]}>
                <Ionicons name="location" size={18} color={locationStatus === 'detected' ? '#059669' : '#0d9488'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.locTitle}>
                  {locationStatus === 'waiting_consent' && '📍 Waiting for GPS Consent'}
                  {locationStatus === 'detecting' && '📡 Detecting Your Location...'}
                  {locationStatus === 'detected' && '📍 Location Detected'}
                  {locationStatus === 'denied' && '⚠️ Location Permission Denied'}
                </Text>
                {userLocation && (
                  <Text style={S.locCoords}>{userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E</Text>
                )}
              </View>
            </View>
            {quote?.zoneSafety?.detected_city && (
              <View style={S.cityBadge}>
                <Text style={S.cityBadgeText}>🏙️ {quote.zoneSafety.detected_city}</Text>
              </View>
            )}
          </View>

          {/* Zone Safety Mini */}
          {quote?.zoneSafety && (
            <View style={S.zoneSafetyBar}>
              <Text style={[S.zoneSafetyScore,
                { color: quote.zoneSafety.safety_score >= 70 ? '#16a34a' : '#ea580c' }
              ]}>
                {quote.zoneSafety.safety_score}/100
              </Text>
              <Text style={S.zoneSafetyLabel}>Zone Safety</Text>
              <View style={{ height: 16, width: 1, backgroundColor: '#d1d5db', marginHorizontal: 6 }} />
              <Text style={{ fontSize: 11, color: quote.zoneSafety.is_safe_zone ? '#16a34a' : '#ea580c', flex: 1 }}>
                {quote.zoneSafety.is_safe_zone ? '✅ Safe zone — eligible for discounts' : '⚠️ Higher risk zone — enhanced coverage recommended'}
              </Text>
            </View>
          )}
        </View>

        {/* ========== LOADING / ANALYSIS ========== */}
        {loading && (
          <View style={S.loadingCard}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="brain" size={32} color="#7c3aed" />
            </View>
            <Text style={S.loadingTitle}>AI Risk Analysis</Text>
            <Text style={S.loadingStep}>{analysisStep}</Text>
            <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
              {['Weather', 'Zone Safety', 'Disruptions', 'Quotes'].map((label, i) => (
                <View key={label} style={S.progressRow}>
                  <Text style={S.progressRowLabel}>{label}</Text>
                  <View style={S.progressBarBg}>
                    <View style={[S.progressBarFill, {
                      width: i < stepIndex ? '100%' : i === stepIndex ? '60%' : '0%'
                    } as any]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ========== ERROR ========== */}
        {error && (
          <View style={S.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#dc2626" />
            <View style={{ flex: 1 }}>
              <Text style={S.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => userLocation && fetchQuote(weekStart, weekEndStr, userLocation.lat, userLocation.lng)}>
                <Text style={S.retryLink}>→ Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========== QUOTE DATA ========== */}
        {quote && !loading && (
          <View style={{ gap: 16 }}>

            {/* ===== PLAN SELECTION CARDS ===== */}
            {/* BASIC SHIELD */}
            <TouchableOpacity
              style={[S.planCard, selectedPlan === 'basic' && S.planCardBasicSel]}
              onPress={() => setSelectedPlan('basic')}
              activeOpacity={0.85}
            >
              {selectedPlan === 'basic' && (
                <View style={[S.selectedCheck, { backgroundColor: '#0d9488' }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
              <View style={S.planHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#0d9488" />
                <View style={{ flex: 1 }}>
                  <Text style={S.planName}>{quote.plans?.basic?.plan_name || '🛡️ Basic Shield'}</Text>
                  <Text style={S.planTagline}>{quote.plans?.basic?.plan_tagline || 'Essential protection'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[S.planPrice, { color: '#0d9488' }]}>₹{quote.plans?.basic?.totalAmount || 28}</Text>
                  <Text style={S.planPriceSub}>/ week</Text>
                  <Text style={S.dailyCost}>₹{quote.plans?.basic?.daily_premium || 4}/day</Text>
                </View>
              </View>
              <View style={S.planDetails}>
                <View style={S.planDetailRow}>
                  <Ionicons name="time-outline" size={14} color="#0d9488" />
                  <Text style={S.planDetailText}>{quote.plans?.basic?.dynamic_coverage?.total_hours || 8}h daily coverage</Text>
                </View>
                <View style={S.planDetailRow}>
                  <Ionicons name="flash-outline" size={14} color="#0d9488" />
                  <Text style={S.planDetailText}>Up to ₹{quote.plans?.basic?.max_claim_payout || 500} per claim</Text>
                </View>
                <View style={S.planDetailRow}>
                  <Ionicons name="hourglass-outline" size={14} color="#0d9488" />
                  <Text style={S.planDetailText}>{quote.plans?.basic?.claim_processing || '24 hours'} processing</Text>
                </View>
              </View>
              <View style={S.coversSection}>
                {(quote.plans?.basic?.covers || ['Flood/Rain', 'Extreme Heat']).map((c: string, i: number) => (
                  <Text key={i} style={S.coverGreen}>✅ {c}</Text>
                ))}
                {(quote.plans?.basic?.does_not_cover || []).slice(0, 2).map((c: string, i: number) => (
                  <Text key={`nc-${i}`} style={S.coverGray}>✕ {c}</Text>
                ))}
              </View>
            </TouchableOpacity>

            {/* TOTAL GUARD (PREMIUM) */}
            <TouchableOpacity
              style={[S.planCard, selectedPlan === 'premium' && S.planCardPremiumSel]}
              onPress={() => setSelectedPlan('premium')}
              activeOpacity={0.85}
            >
              <View style={S.recommendedBadge}>
                <Text style={S.recommendedText}>⭐ RECOMMENDED</Text>
              </View>
              {selectedPlan === 'premium' && (
                <View style={[S.selectedCheck, { backgroundColor: '#7c3aed' }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
              <View style={[S.planHeader, { marginTop: 18 }]}>
                <Ionicons name="flash" size={24} color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={S.planName}>{quote.plans?.premium?.plan_name || '⚡ Total Guard'}</Text>
                  <Text style={S.planTagline}>{quote.plans?.premium?.plan_tagline || 'Complete AI-powered protection'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[S.planPrice, { color: '#7c3aed' }]}>₹{quote.plans?.premium?.totalAmount || 49}</Text>
                  <Text style={S.planPriceSub}>/ week</Text>
                  <Text style={S.dailyCost}>₹{quote.plans?.premium?.daily_premium || 7}/day</Text>
                </View>
              </View>
              <View style={S.planDetails}>
                <View style={S.planDetailRow}>
                  <Ionicons name="time-outline" size={14} color="#7c3aed" />
                  <Text style={S.planDetailText}>{quote.plans?.premium?.dynamic_coverage?.total_hours || 16}h daily coverage</Text>
                </View>
                <View style={S.planDetailRow}>
                  <Ionicons name="flash-outline" size={14} color="#7c3aed" />
                  <Text style={S.planDetailText}>Up to ₹{quote.plans?.premium?.max_claim_payout || 1500} per claim</Text>
                </View>
                <View style={S.planDetailRow}>
                  <Ionicons name="hourglass-outline" size={14} color="#7c3aed" />
                  <Text style={S.planDetailText}>{quote.plans?.premium?.claim_processing || 'Instant'} processing</Text>
                </View>
                {quote.plans?.premium?.zone_discount?.applied && (
                  <View style={S.planDetailRow}>
                    <Ionicons name="trending-down" size={14} color="#16a34a" />
                    <Text style={[S.planDetailText, { color: '#16a34a' }]}>Zone discount: -₹{quote.plans.premium.zone_discount.amount_per_week}/wk</Text>
                  </View>
                )}
                {quote.plans?.premium?.dynamic_coverage?.bonus_hours > 0 && (
                  <View style={S.planDetailRow}>
                    <Ionicons name="add-circle-outline" size={14} color="#0d9488" />
                    <Text style={[S.planDetailText, { color: '#0d9488' }]}>+{quote.plans.premium.dynamic_coverage.bonus_hours}h bonus</Text>
                  </View>
                )}
              </View>
              <View style={S.coversSection}>
                {(quote.plans?.premium?.covers || ['Flood/Rain', 'Extreme Heat', 'Curfews', 'Strikes']).map((c: string, i: number) => (
                  <Text key={i} style={S.coverGreen}>✅ {c}</Text>
                ))}
              </View>
            </TouchableOpacity>

            {/* ===== LIQUIDITY POOL INFO ===== */}
            {currentPlan?.liquidity_pool && (
              <View style={S.liquidityCard}>
                <Ionicons name="people" size={22} color="#0d9488" />
                <View style={{ flex: 1 }}>
                  <Text style={S.liquidityTitle}>🏦 Community Liquidity Pool</Text>
                  <Text style={S.liquidityDesc}>
                    {currentPlan.liquidity_pool.message}. As more workers join, the pool grows — enabling instant automatic payouts.
                  </Text>
                  <Text style={S.liquidityMeta}>
                    Pool share: {currentPlan.liquidity_pool.pool_share} of your ₹{currentPlan.weekly_premium}/week premium
                  </Text>
                </View>
              </View>
            )}

            {/* ===== WEATHER FORECAST ===== */}
            {quote.weatherForecast && quote.weatherForecast.length > 0 && (
              <View style={S.sectionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="thunderstorm" size={20} color="#0d9488" />
                    <Text style={S.sectionCardTitle}>Weather Forecast</Text>
                  </View>
                  {quote.currentWeather?.city && (
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>📍 {quote.currentWeather.city}</Text>
                  )}
                </View>

                {/* Current Weather */}
                {quote.currentWeather && (
                  <View style={S.currentWeatherBar}>
                    <View>
                      <Text style={S.currentTemp}>{Math.round(quote.currentWeather.temperature || 0)}°C</Text>
                      <Text style={S.currentDesc}>{quote.currentWeather.weather_description || ''}</Text>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="water" size={16} color="#0d9488" />
                        <Text style={S.currentMetaVal}>{Math.round(quote.currentWeather.humidity || 0)}%</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Feather name="wind" size={16} color="#64748b" />
                        <Text style={S.currentMetaVal}>{Math.round(quote.currentWeather.wind_speed || 0)} m/s</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Ionicons name="eye" size={16} color="#94a3b8" />
                        <Text style={S.currentMetaVal}>{Math.round((quote.currentWeather.visibility || 10000) / 1000)} km</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* 5-day forecast */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {quote.weatherForecast.slice(0, 7).map((day: any, idx: number) => {
                      const emoji = day.dominant_weather === 'Rain' ? '🌧️' : day.dominant_weather === 'Clouds' ? '☁️'
                        : day.dominant_weather === 'Clear' ? '☀️' : day.dominant_weather === 'Thunderstorm' ? '⛈️' : '🌤️';
                      return (
                        <View key={day.date || idx} style={S.forecastDay}>
                          <Text style={S.forecastDayLabel}>{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</Text>
                          <Text style={{ fontSize: 20, marginVertical: 4 }}>{emoji}</Text>
                          <Text style={S.forecastTemp}>{Math.round(day.temp_max)}°</Text>
                          {day.rain_total_mm > 0 && <Text style={S.forecastRain}>💧{Math.round(day.rain_total_mm)}mm</Text>}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ===== AI RISK ANALYSIS ===== */}
            <View style={S.sectionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="brain" size={20} color="#7c3aed" />
                  <Text style={S.sectionCardTitle}>AI Risk Analysis</Text>
                </View>
                {quote.mlPowered && (
                  <Text style={{ fontSize: 10, color: '#7c3aed' }}>
                    GBDT v2.0 • {Math.round((currentPlan?.confidence || 0.85) * 100)}%
                  </Text>
                )}
              </View>

              {/* Risk Score Grid */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Weather Risk */}
                <View style={S.riskBox}>
                  <Ionicons name="thunderstorm" size={20} color="#0d9488" />
                  <Text style={[S.riskScore, { color: '#0d9488' }]}>{quote.weatherRisk?.score || 0}</Text>
                  <Text style={S.riskLabel}>Weather Risk</Text>
                  <Text style={S.riskLevel}>{quote.weatherRisk?.risk_level || 'N/A'}</Text>
                </View>
                {/* Zone Safety */}
                <View style={S.riskBox}>
                  <Ionicons name="location" size={20} color={(quote.zoneSafety?.safety_score || 0) >= 70 ? '#16a34a' : '#ea580c'} />
                  <Text style={[S.riskScore, { color: (quote.zoneSafety?.safety_score || 0) >= 70 ? '#16a34a' : '#ea580c' }]}>
                    {quote.zoneSafety?.safety_score || 0}
                  </Text>
                  <Text style={S.riskLabel}>Zone Safety</Text>
                  <Text style={S.riskLevel}>{quote.zoneSafety?.is_safe_zone ? '✅ Safe' : '⚠️ At Risk'}</Text>
                </View>
                {/* Disruption */}
                <View style={S.riskBox}>
                  <Ionicons name="flash" size={20} color="#f59e0b" />
                  <Text style={[S.riskScore, { color: '#f59e0b' }]}>
                    {Math.round((quote.disruptionForecast?.weekly_summary?.avg_disruption_probability || 0) * 100)}%
                  </Text>
                  <Text style={S.riskLabel}>Disruption</Text>
                  <Text style={S.riskLevel}>{quote.disruptionForecast?.weekly_summary?.risk_level || 'N/A'}</Text>
                </View>
              </View>

              {/* Daily Disruption Risk Bar Chart */}
              {quote.disruptionForecast?.daily && (
                <View style={S.barChartBox}>
                  <Text style={S.barChartTitle}>DAILY DISRUPTION RISK</Text>
                  <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end', height: 56 }}>
                    {quote.disruptionForecast.daily.slice(0, 7).map((day: any, idx: number) => {
                      const prob = day.disruption_probability || 0;
                      const h = Math.max(6, prob * 50);
                      const color = prob > 0.4 ? '#ef4444' : prob > 0.2 ? '#f97316' : prob > 0.1 ? '#fbbf24' : '#22c55e';
                      return (
                        <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                          <View style={{ width: '80%', height: 50, backgroundColor: '#e2e8f0', borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' }}>
                            <View style={{ width: '100%', height: h, backgroundColor: color, borderRadius: 3 }} />
                          </View>
                          <Text style={{ fontSize: 9, color: '#94a3b8', fontWeight: '600', marginTop: 3 }}>
                            {new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* ===== AFFORDABILITY ===== */}
            {quote.affordability && (
              <View style={S.affordabilityCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>💰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.affordabilityTitle}>{quote.affordability.message}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={S.affordLabel}>Weekly Earnings</Text>
                        <Text style={S.affordValue}>₹{quote.affordability.typicalWeeklyEarnings}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.affordLabel}>Basic Shield</Text>
                        <Text style={[S.affordValue, { color: '#0d9488' }]}>{quote.affordability.basicAsPercentage}%</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.affordLabel}>Total Guard</Text>
                        <Text style={[S.affordValue, { color: '#7c3aed' }]}>{quote.affordability.premiumAsPercentage}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ===== SUMMARY BAR ===== */}
            <View style={S.summaryBar}>
              <View>
                <Text style={S.summaryLabel}>Selected Plan</Text>
                <Text style={S.summaryValue}>{selectedPlan === 'premium' ? '⚡ Total Guard' : '🛡️ Basic Shield'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={S.summaryLabel}>You Pay</Text>
                <Text style={[S.summaryAmount, { color: selectedPlan === 'premium' ? '#7c3aed' : '#0d9488' }]}>
                  ₹{currentPlan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28)}
                </Text>
              </View>
            </View>

            {/* Demo Note */}
            <View style={S.demoNote}>
              <Ionicons name="information-circle-outline" size={16} color="#92400e" />
              <Text style={S.demoNoteText}>
                Demo mode: Payment is simulated for Expo Go testing. In production, Razorpay native checkout will open.
              </Text>
            </View>
          </View>
        )}

        {/* ========== DPDP ACT 2023 — DATA CONSENT ========== */}
        <View style={S.consentCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="shield-checkmark" size={18} color="#0d9488" />
              <Text style={S.consentTitle}>DPDP Act 2023 — Data Consent</Text>
            </View>
            <Text style={S.consentSubtext}>
              As per the Digital Personal Data Protection Act, 2023, we require your explicit consent before processing your data. You may withdraw consent at any time from Settings.
            </Text>

            <TouchableOpacity style={S.consentRow} onPress={handleGPSConsent} activeOpacity={0.7}>
              <Ionicons name={consentGPS ? 'checkbox' : 'square-outline'} size={22} color={consentGPS ? '#0d9488' : '#94a3b8'} />
              <View style={{ flex: 1 }}>
                <Text style={S.consentText}>
                  I consent to <Text style={{ fontWeight: '700' }}>GPS Location sharing</Text> for trigger validation.
                </Text>
                {locationStatus === 'detecting' && <Text style={{ fontSize: 11, color: '#0d9488', marginTop: 2 }}>(requesting permission...)</Text>}
                {locationStatus === 'denied' && <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>(permission denied — enable in Settings)</Text>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={S.consentRow} onPress={() => setConsentUPI(!consentUPI)} activeOpacity={0.7}>
              <Ionicons name={consentUPI ? 'checkbox' : 'square-outline'} size={22} color={consentUPI ? '#0d9488' : '#94a3b8'} />
              <Text style={S.consentText}>
                I consent to <Text style={{ fontWeight: '700' }}>Bank/UPI data collection</Text> for payout disbursement.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={S.consentRow} onPress={() => setConsentPlatform(!consentPlatform)} activeOpacity={0.7}>
              <Ionicons name={consentPlatform ? 'checkbox' : 'square-outline'} size={22} color={consentPlatform ? '#0d9488' : '#94a3b8'} />
              <Text style={S.consentText}>
                I consent to sharing <Text style={{ fontWeight: '700' }}>Platform Activity Data</Text> to confirm active delivery days.
              </Text>
            </TouchableOpacity>

            {!allConsentsGiven && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="warning" size={13} color="#d97706" />
                <Text style={{ fontSize: 11, color: '#d97706' }}>All three consents are required to proceed.</Text>
              </View>
            )}
          </View>

        {/* ========== BUTTONS ========== */}
        <View style={S.buttonRow}>
          <TouchableOpacity style={S.backBtn} onPress={onBack} activeOpacity={0.85}>
            <Ionicons name="chevron-back" size={18} color="#0d9488" />
            <Text style={S.backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.payBtn, (!quote || loading || paying || !allConsentsGiven) && S.payBtnDisabled]}
            onPress={handlePayment}
            disabled={!quote || loading || paying || !allConsentsGiven}
            activeOpacity={0.85}
          >
            {paying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={S.payBtnText}>Pay ₹{currentPlan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0fdfa' },
  scroll: { padding: 16, paddingBottom: 48, gap: 16 },

  // Header Banner
  headerBanner: { backgroundColor: '#7c3aed', borderRadius: 16, padding: 20, overflow: 'hidden' },
  aiBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },

  // Progress
  progress: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40 },
  progressDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressLine: { height: 3, flex: 1, marginHorizontal: 4, borderRadius: 2 },

  // Location
  locationCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  locIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  locTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  locCoords: { fontSize: 11, color: '#64748b', marginTop: 2 },
  cityBadge: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  cityBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  zoneSafetyBar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, gap: 4 },
  zoneSafetyScore: { fontSize: 16, fontWeight: '800' },
  zoneSafetyLabel: { fontSize: 11, color: '#64748b' },

  // Loading
  loadingCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 20, alignItems: 'center' },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 4 },
  loadingStep: { fontSize: 13, color: '#7c3aed', fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressRowLabel: { width: 80, fontSize: 11, color: '#64748b' },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#7c3aed', borderRadius: 3 },

  // Error
  errorBox: { flexDirection: 'row', gap: 10, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 10, padding: 14 },
  errorText: { fontSize: 13, color: '#dc2626' },
  retryLink: { fontSize: 13, color: '#dc2626', fontWeight: '700', marginTop: 4 },

  // Plan Cards
  planCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', padding: 16, position: 'relative', overflow: 'visible' },
  planCardBasicSel: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  planCardPremiumSel: { borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  selectedCheck: { position: 'absolute', top: -10, right: -10, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  recommendedBadge: { position: 'absolute', top: -12, left: 14, backgroundColor: '#7c3aed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, zIndex: 10 },
  recommendedText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  planName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  planTagline: { fontSize: 11, color: '#64748b', marginTop: 2 },
  planPrice: { fontSize: 28, fontWeight: '800' },
  planPriceSub: { fontSize: 12, color: '#64748b' },
  dailyCost: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  planDetails: { gap: 6, marginBottom: 10 },
  planDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planDetailText: { fontSize: 12, color: '#334155' },
  coversSection: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, gap: 3 },
  coverGreen: { fontSize: 12, color: '#16a34a' },
  coverGray: { fontSize: 12, color: '#94a3b8', textDecorationLine: 'line-through' },

  // Liquidity
  liquidityCard: { flexDirection: 'row', gap: 10, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 14, padding: 14 },
  liquidityTitle: { fontSize: 14, fontWeight: '700', color: '#0d9488' },
  liquidityDesc: { fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 17 },
  liquidityMeta: { fontSize: 11, color: '#94a3b8', marginTop: 6 },



  // Weather
  sectionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 14 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  currentWeatherBar: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12 },
  currentTemp: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  currentDesc: { fontSize: 11, color: '#64748b', textTransform: 'capitalize' },
  currentMetaVal: { fontSize: 11, color: '#475569', fontWeight: '600', marginTop: 2 },
  forecastDay: { width: 64, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 8, alignItems: 'center' },
  forecastDayLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  forecastTemp: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  forecastRain: { fontSize: 9, color: '#0d9488', marginTop: 2, fontWeight: '600' },

  // Risk Analysis
  riskBox: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, alignItems: 'center', gap: 4 },
  riskScore: { fontSize: 22, fontWeight: '800' },
  riskLabel: { fontSize: 10, color: '#94a3b8' },
  riskLevel: { fontSize: 10, color: '#475569', fontWeight: '600' },
  barChartBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginTop: 12 },
  barChartTitle: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 8 },

  // Affordability
  affordabilityCard: { backgroundColor: '#f0fdf4', borderLeftWidth: 4, borderLeftColor: '#22c55e', borderRadius: 10, padding: 14 },
  affordabilityTitle: { fontSize: 14, fontWeight: '700', color: '#15803d' },
  affordLabel: { fontSize: 10, color: '#94a3b8' },
  affordValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 2 },

  // Summary
  summaryBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16 },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  summaryAmount: { fontSize: 26, fontWeight: '800' },

  // Demo Note
  demoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 12 },
  demoNoteText: { fontSize: 12, color: '#92400e', lineHeight: 17, flex: 1 },

  // DPDP Consent
  consentCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, gap: 10 },
  consentTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  consentSubtext: { fontSize: 11, color: '#64748b', lineHeight: 16, marginBottom: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  consentText: { fontSize: 13, color: '#334155', lineHeight: 19, flex: 1 },

  // Buttons
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  backBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: '#0d9488', borderRadius: 12, paddingVertical: 14 },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  payBtn: { flex: 2, backgroundColor: '#0d9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  payBtnDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0 },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default OnboardingStep2Screen;
