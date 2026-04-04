import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ImageBackground,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

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
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'detected' | 'denied'>('detecting');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [analysisStep, setAnalysisStep] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchQuote(weekStart, weekEndStr, userLocation.lat, userLocation.lng);
    }
  }, [userLocation]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        setUserLocation({ lat: 17.385, lng: 78.4867 }); // Hyderabad fallback
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocationStatus('detected');
    } catch {
      setLocationStatus('denied');
      setUserLocation({ lat: 17.385, lng: 78.4867 });
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
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!quote) return;
    const plan = quote.plans?.[selectedPlan];
    const amount = plan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28);

    Alert.alert(
      '💳 Confirm Payment',
      `Pay ₹${amount} for ${plan?.plan_name || selectedPlan === 'premium' ? 'Total Guard' : 'Basic Shield'} weekly plan?\n\n(Demo mode — simulated payment for Expo Go testing)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay ₹${amount}`,
          onPress: async () => {
            setPaying(true);
            setError(null);
            try {
              await apiService.simulatePayment({
                startDate: weekStart,
                endDate: weekEndStr,
                amount,
                days: quote.days || 7,
                platform: (user as any)?.platform || 'unknown',
                riskTier: plan?.risk_tier || '🟡 Moderate',
                planType: selectedPlan,
              });
              await refreshUser();
              setSuccess(true);
              setTimeout(() => onComplete(), 1800);
            } catch (err: any) {
              setError(err?.response?.data?.error || 'Payment failed. Please try again.');
            } finally {
              setPaying(false);
            }
          },
        },
      ]
    );
  };

  const currentPlan = quote?.plans?.[selectedPlan];

  if (success) {
    return (
      <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
              <Text style={{ fontSize: 64 }}>✅</Text>
              <Text style={styles.successTitle}>Subscription Activated!</Text>
              <Text style={styles.successSub}>
                Your {selectedPlan === 'premium' ? 'Total Guard ⚡' : 'Basic Shield 🛡️'} plan is now active.
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>

            {/* Header Banner */}
            <View style={styles.banner}>
              <Text style={styles.bannerBadge}>🧠 AI-Powered</Text>
              <Text style={styles.bannerTitle}>Choose Your Protection Plan</Text>
              <Text style={styles.bannerSub}>
                Two plans powered by ML risk analysis of your zone's weather, traffic & disruption data.
              </Text>
            </View>

            {/* Progress */}
            <View style={styles.progress}>
              <View style={[styles.progressDot, { backgroundColor: '#10b981' }]}>
                <Text style={styles.progressDotText}>✓</Text>
              </View>
              <View style={[styles.progressLine, { backgroundColor: '#10b981' }]} />
              <View style={[styles.progressDot, { backgroundColor: '#0d9488' }]}>
                <Text style={styles.progressDotText}>2</Text>
              </View>
            </View>

            {/* Location Card */}
            <View style={[styles.locationCard,
              locationStatus === 'detected' ? { backgroundColor: '#f0fdf4', borderColor: '#86efac' }
              : { backgroundColor: 'rgba(255,255,255,0.80)', borderColor: '#e2e8f0' }
            ]}>
              <Text style={{ fontSize: 16, marginBottom: 2 }}>
                {locationStatus === 'detecting' ? '📡' : locationStatus === 'detected' ? '📍' : '⚠️'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>
                  {locationStatus === 'detecting' && 'Detecting Your Location...'}
                  {locationStatus === 'detected' && 'Location Detected'}
                  {locationStatus === 'denied' && 'Using Default Location (Hyderabad)'}
                </Text>
                {userLocation && (
                  <Text style={styles.locationCoords}>
                    {userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E
                  </Text>
                )}
                {quote?.zoneSafety?.detected_city && (
                  <Text style={styles.locationCity}>🏙️ {quote.zoneSafety.detected_city}</Text>
                )}
              </View>
            </View>

            {/* Loading / Analysis */}
            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#8b5cf6" style={{ marginBottom: 12 }} />
                <Text style={styles.loadingTitle}>AI Risk Analysis</Text>
                <Text style={styles.loadingStep}>{analysisStep}</Text>
                {ANALYSIS_STEPS.slice(0, 4).map((step, i) => (
                  <View key={i} style={styles.progressRow}>
                    <Text style={styles.progressRowLabel} numberOfLines={1}>
                      {['Weather', 'Zone Safety', 'Disruptions', 'Quotes'][i]}
                    </Text>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: i < stepIndex ? '100%' : i === stepIndex ? '60%' : '0%' }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Error */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => userLocation && fetchQuote(weekStart, weekEndStr, userLocation.lat, userLocation.lng)}>
                  <Text style={styles.retryLink}>→ Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Plan Selection */}
            {quote && !loading && (
              <>
                {/* Zone Safety */}
                {quote.zoneSafety && (
                  <View style={styles.zoneSafetyRow}>
                    <Text style={[styles.safetyScore,
                      { color: quote.zoneSafety.safety_score >= 70 ? '#16a34a' : '#ea580c' }
                    ]}>
                      {quote.zoneSafety.safety_score}/100
                    </Text>
                    <Text style={styles.safetyLabel}>Zone Safety</Text>
                    <Text style={{ marginLeft: 8, fontSize: 12, color: quote.zoneSafety.is_safe_zone ? '#16a34a' : '#ea580c' }}>
                      {quote.zoneSafety.is_safe_zone ? '✅ Safe zone' : '⚠️ Higher risk zone'}
                    </Text>
                  </View>
                )}

                {/* BASIC PLAN */}
                <TouchableOpacity
                  style={[styles.planCard, selectedPlan === 'basic' && styles.planCardBasicSelected]}
                  onPress={() => setSelectedPlan('basic')}
                  activeOpacity={0.8}
                >
                  {selectedPlan === 'basic' && <Text style={styles.planSelectedBadge}>✓ SELECTED</Text>}
                  <View style={styles.planHeader}>
                    <Text style={styles.planEmoji}>🛡️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{quote.plans?.basic?.plan_name || 'Basic Shield'}</Text>
                      <Text style={styles.planTagline}>{quote.plans?.basic?.plan_tagline || 'Essential protection'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.planPrice, { color: '#0d9488' }]}>₹{quote.plans?.basic?.totalAmount || 28}</Text>
                      <Text style={styles.planPriceLabel}>/week</Text>
                    </View>
                  </View>
                  <View style={styles.planDetails}>
                    <Text style={styles.planDetailItem}>⏰ {quote.plans?.basic?.dynamic_coverage?.total_hours || 8}h daily coverage</Text>
                    <Text style={styles.planDetailItem}>💰 Up to ₹{quote.plans?.basic?.max_claim_payout || 500} per claim</Text>
                    <Text style={styles.planDetailItem}>🕐 {quote.plans?.basic?.claim_processing || '24h'} processing</Text>
                  </View>
                  <View style={styles.planCovers}>
                    {(quote.plans?.basic?.covers || ['Flood/Rain', 'Extreme Heat']).map((c: string, i: number) => (
                      <Text key={i} style={styles.coverItem}>✅ {c}</Text>
                    ))}
                  </View>
                </TouchableOpacity>

                {/* PREMIUM PLAN */}
                <TouchableOpacity
                  style={[styles.planCard, selectedPlan === 'premium' && styles.planCardPremiumSelected]}
                  onPress={() => setSelectedPlan('premium')}
                  activeOpacity={0.8}
                >
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>⭐ RECOMMENDED</Text>
                  </View>
                  {selectedPlan === 'premium' && <Text style={[styles.planSelectedBadge, { color: '#7c3aed' }]}>✓ SELECTED</Text>}
                  <View style={[styles.planHeader, { marginTop: 24 }]}>
                    <Text style={styles.planEmoji}>⚡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planName}>{quote.plans?.premium?.plan_name || 'Total Guard'}</Text>
                      <Text style={styles.planTagline}>{quote.plans?.premium?.plan_tagline || 'Complete AI-powered protection'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.planPrice, { color: '#7c3aed' }]}>₹{quote.plans?.premium?.totalAmount || 49}</Text>
                      <Text style={styles.planPriceLabel}>/week</Text>
                    </View>
                  </View>
                  <View style={styles.planDetails}>
                    <Text style={styles.planDetailItem}>⏰ {quote.plans?.premium?.dynamic_coverage?.total_hours || 16}h daily coverage</Text>
                    <Text style={styles.planDetailItem}>💰 Up to ₹{quote.plans?.premium?.max_claim_payout || 1500} per claim</Text>
                    <Text style={styles.planDetailItem}>⚡ {quote.plans?.premium?.claim_processing || 'Instant'} processing</Text>
                    {quote.plans?.premium?.zone_discount?.applied && (
                      <Text style={[styles.planDetailItem, { color: '#16a34a' }]}>
                        📉 Zone discount: -₹{quote.plans.premium.zone_discount.amount_per_week}/wk
                      </Text>
                    )}
                  </View>
                  <View style={styles.planCovers}>
                    {(quote.plans?.premium?.covers || ['Flood/Rain', 'Extreme Heat', 'Curfews', 'Strikes']).map((c: string, i: number) => (
                      <Text key={i} style={styles.coverItem}>✅ {c}</Text>
                    ))}
                  </View>
                </TouchableOpacity>

                {/* Summary Bar */}
                <View style={styles.summaryBar}>
                  <View>
                    <Text style={styles.summaryLabel}>Selected Plan</Text>
                    <Text style={styles.summaryValue}>{selectedPlan === 'premium' ? '⚡ Total Guard' : '🛡️ Basic Shield'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.summaryLabel}>You Pay</Text>
                    <Text style={[styles.summaryAmount, { color: selectedPlan === 'premium' ? '#7c3aed' : '#0d9488' }]}>
                      ₹{currentPlan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28)}
                    </Text>
                  </View>
                </View>

                {/* Demo note */}
                <View style={styles.demoNote}>
                  <Text style={styles.demoNoteText}>
                    ℹ️ Demo mode: Payment is simulated for Expo Go testing. In production, Razorpay native checkout will open.
                  </Text>
                </View>
              </>
            )}

            {/* Back & Pay buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payBtn, (!quote || loading || paying) && styles.btnDisabled]}
                onPress={handlePayment}
                disabled={!quote || loading || paying}
                activeOpacity={0.8}
              >
                {paying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.payBtnText}>
                    Pay ₹{currentPlan?.totalAmount || (selectedPlan === 'premium' ? 49 : 28)} →
                  </Text>
                )}
              </TouchableOpacity>
            </View>

          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bgImage: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 20, paddingBottom: 48 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  banner: {
    backgroundColor: 'rgba(109,40,217,0.85)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  bannerBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 18 },

  progress: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  progressDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressLine: { height: 3, backgroundColor: '#e2e8f0', flex: 1, marginHorizontal: 4 },

  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  locationTitle: { fontSize: 14, fontWeight: '600', color: '#134e4a' },
  locationCoords: { fontSize: 11, fontFamily: 'monospace', color: '#64748b', marginTop: 2 },
  locationCity: { fontSize: 12, color: '#0d9488', fontWeight: '600', marginTop: 2 },

  loadingCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 4 },
  loadingStep: { fontSize: 13, color: '#7c3aed', fontWeight: '500', marginBottom: 16, textAlign: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, width: '100%' },
  progressRowLabel: { width: 90, fontSize: 11, color: '#64748b' },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#7c3aed', borderRadius: 3 },

  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#dc2626' },
  retryLink: { fontSize: 13, color: '#dc2626', fontWeight: '700', marginTop: 6 },

  zoneSafetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 6,
  },
  safetyScore: { fontSize: 18, fontWeight: '800' },
  safetyLabel: { fontSize: 12, color: '#64748b' },

  planCard: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
    position: 'relative',
  },
  planCardBasicSelected: { borderColor: '#0d9488', backgroundColor: 'rgba(240,253,250,0.95)' },
  planCardPremiumSelected: { borderColor: '#7c3aed', backgroundColor: 'rgba(250,245,255,0.95)' },
  planSelectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 11,
    fontWeight: '800',
    color: '#0d9488',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    left: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  recommendedText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  planEmoji: { fontSize: 28 },
  planName: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  planTagline: { fontSize: 12, color: '#64748b', marginTop: 2 },
  planPrice: { fontSize: 26, fontWeight: '800' },
  planPriceLabel: { fontSize: 12, color: '#64748b' },
  planDetails: { gap: 4, marginBottom: 10 },
  planDetailItem: { fontSize: 12, color: '#334155' },
  planCovers: { gap: 3, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
  coverItem: { fontSize: 12, color: '#16a34a' },

  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryLabel: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  summaryAmount: { fontSize: 24, fontWeight: '800' },

  demoNote: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  demoNoteText: { fontSize: 12, color: '#92400e', lineHeight: 17 },

  buttonRow: { flexDirection: 'row', gap: 12 },
  backBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  payBtn: {
    flex: 2,
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#94a3b8' },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  successTitle: { fontSize: 24, fontWeight: '800', color: '#134e4a', marginTop: 12 },
  successSub: { fontSize: 15, color: '#0f766e', textAlign: 'center', marginTop: 6 },
});

export default OnboardingStep2Screen;
