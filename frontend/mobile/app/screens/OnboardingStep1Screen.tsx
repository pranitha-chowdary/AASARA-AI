import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PLATFORMS = [
  { id: 'zomato', name: 'Zomato', icon: 'silverware-fork-knife' as const, color: '#ef4444', desc: 'Food Delivery', gradient: ['#dc2626', '#ef4444'] },
  { id: 'swiggy', name: 'Swiggy', icon: 'silverware-fork-knife' as const, color: '#f97316', desc: 'Food & Instamart', gradient: ['#ea580c', '#f97316'] },
  { id: 'dunzo', name: 'Dunzo', icon: 'shopping' as const, color: '#8b5cf6', desc: 'Hyperlocal', gradient: ['#7c3aed', '#8b5cf6'] },
  { id: 'other', name: 'Other', icon: 'package-variant' as const, color: '#64748b', desc: 'Any Platform', gradient: ['#475569', '#64748b'] },
];

interface Props {
  onComplete: () => void;
}

const OnboardingStep1Screen: React.FC<Props> = ({ onComplete }) => {
  const { user, refreshUser } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformCode, setPlatformCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLink = async () => {
    if (!selectedPlatform) return;
    if (upiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. yourname@okicici)');
      return;
    }
    setLoading(true);
    try {
      await apiService.linkPlatform(selectedPlatform, platformCode || undefined, upiId || undefined);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => onComplete(), 1200);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to link platform. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d9488" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ========== WELCOME BANNER ========== */}
          <View style={S.banner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={S.bannerIcon}>
                <Ionicons name="hand-right" size={18} color="#fff" />
              </View>
              <Text style={S.bannerStep}>STEP 1 OF 2</Text>
            </View>
            <Text style={S.bannerTitle}>Welcome, {user?.fullName}! 👋</Text>
            <Text style={S.bannerSub}>Let's set up your protection plan in 2 quick steps.</Text>
          </View>

          {/* ========== PROGRESS ========== */}
          <View style={S.progress}>
            <View style={[S.progressDot, { backgroundColor: '#0d9488' }]}>
              <Text style={S.progressDotText}>1</Text>
            </View>
            <View style={[S.progressLine, { backgroundColor: '#0d9488' }]} />
            <View style={[S.progressLine, { backgroundColor: '#e2e8f0' }]} />
            <View style={[S.progressDot, { backgroundColor: '#e2e8f0' }]}>
              <Text style={[S.progressDotText, { color: '#94a3b8' }]}>2</Text>
            </View>
          </View>

          {/* ========== TITLE ========== */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="link" size={20} color="#134e4a" />
            <Text style={S.title}>Link Your Delivery Platform</Text>
          </View>
          <Text style={S.subtitle}>
            Connect your delivery account to enable real-time monitoring and automatic payouts when disruptions hit.
          </Text>

          {/* ========== PLATFORM CARDS ========== */}
          <View style={S.platformGrid}>
            {PLATFORMS.map((p) => {
              const isSelected = selectedPlatform === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[S.platformCard, isSelected && { borderColor: p.color, backgroundColor: `${p.color}12` }]}
                  onPress={() => setSelectedPlatform(p.id)}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <View style={[S.selectBadge, { backgroundColor: p.color }]}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                  <View style={[S.platformIconCircle, { backgroundColor: `${p.color}18` }]}>
                    <MaterialCommunityIcons name={p.icon} size={28} color={p.color} />
                  </View>
                  <Text style={[S.platformName, isSelected && { color: p.color }]}>{p.name}</Text>
                  <Text style={S.platformDesc}>{p.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ========== PARTNER ID ========== */}
          {selectedPlatform && (
            <View style={S.inputWrapper}>
              <Text style={S.inputLabel}>
                <Ionicons name="key-outline" size={12} color="#134e4a" /> Partner ID / Platform Code
                <Text style={{ color: '#94a3b8', fontWeight: '400' }}> (Optional)</Text>
              </Text>
              <View style={S.inputContainer}>
                <Ionicons name="barcode-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={S.input}
                  placeholder={`Your ${PLATFORMS.find(p => p.id === selectedPlatform)?.name || ''} partner ID`}
                  placeholderTextColor="#94a3b8"
                  value={platformCode}
                  onChangeText={setPlatformCode}
                  autoCapitalize="none"
                />
              </View>
              <Text style={S.inputHint}>Find this in your partner app settings or leave blank.</Text>
            </View>
          )}

          {/* ========== UPI ID ========== */}
          {selectedPlatform && (
            <View style={S.inputWrapper}>
              <Text style={S.inputLabel}>
                <Ionicons name="wallet-outline" size={12} color="#134e4a" /> UPI ID for Payouts
                <Text style={{ color: '#ef4444', fontWeight: '600' }}> *</Text>
              </Text>
              <View style={S.inputContainer}>
                <Ionicons name="card-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={S.input}
                  placeholder="yourname@okicici, yourname@paytm"
                  placeholderTextColor="#94a3b8"
                  value={upiId}
                  onChangeText={(t) => setUpiId(t.toLowerCase().trim())}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              <Text style={S.inputHint}>Disruption payouts from the community pool will be sent to this UPI ID.</Text>
            </View>
          )}

          {/* ========== SUCCESS ========== */}
          {success && (
            <View style={S.successBox}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={S.successText}>Platform Linked! Proceeding to payment setup...</Text>
            </View>
          )}

          {/* ========== CTA ========== */}
          <TouchableOpacity
            style={[S.btn, (!selectedPlatform || loading || success) && S.btnDisabled]}
            onPress={handleLink}
            disabled={!selectedPlatform || loading || success}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="link-outline" size={20} color="#fff" />
                <Text style={S.btnText}>Link Platform & Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* ========== INFO NOTE ========== */}
          <View style={S.infoNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#0d9488" />
            <Text style={S.infoNoteText}>
              Your data is encrypted end-to-end. We only use your platform connection to verify your earnings and auto-trigger payouts.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0fdfa' },
  scroll: { padding: 16, paddingBottom: 48 },

  // Banner
  banner: { backgroundColor: '#0d9488', borderRadius: 16, padding: 20, marginBottom: 20 },
  bannerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bannerStep: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  // Progress
  progress: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingHorizontal: 30 },
  progressDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressLine: { height: 3, flex: 1, marginHorizontal: 4, borderRadius: 2 },

  // Title
  title: { fontSize: 20, fontWeight: '700', color: '#134e4a' },
  subtitle: { fontSize: 14, color: '#0f766e', marginBottom: 24, lineHeight: 20 },

  // Platforms
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  platformCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  selectBadge: { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  platformIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  platformName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  platformDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Input
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#134e4a', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  input: { flex: 1, fontSize: 14, color: '#0f172a', paddingVertical: 10 },
  inputHint: { fontSize: 11, color: '#64748b', marginTop: 4 },

  // Success
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successText: { fontSize: 14, color: '#15803d', fontWeight: '600', flex: 1 },

  // Button
  btn: {
    backgroundColor: '#0d9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#ccfbf1',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  infoNoteText: { fontSize: 12, color: '#0f766e', lineHeight: 17, flex: 1 },
});

export default OnboardingStep1Screen;
