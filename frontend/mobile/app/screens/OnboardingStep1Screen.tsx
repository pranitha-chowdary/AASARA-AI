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
  ImageBackground,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PLATFORMS = [
  { id: 'zomato', name: 'Zomato', emoji: '🍕', color: '#ef4444' },
  { id: 'swiggy', name: 'Swiggy', emoji: '🛵', color: '#f97316' },
  { id: 'dunzo', name: 'Dunzo', emoji: '📦', color: '#8b5cf6' },
  { id: 'other', name: 'Other', emoji: '🚴', color: '#64748b' },
];

interface Props {
  onComplete: () => void;
}

const OnboardingStep1Screen: React.FC<Props> = ({ onComplete }) => {
  const { user, refreshUser } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformCode, setPlatformCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLink = async () => {
    if (!selectedPlatform) return;
    setLoading(true);
    try {
      await apiService.linkPlatform(selectedPlatform, platformCode || undefined);
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
    <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Welcome Banner */}
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Welcome, {user?.fullName}! 👋</Text>
              <Text style={styles.bannerSub}>Let's set up your protection plan in 2 quick steps.</Text>
            </View>

            {/* Progress */}
            <View style={styles.progress}>
              <View style={[styles.progressDot, { backgroundColor: '#0d9488' }]}>
                <Text style={styles.progressDotText}>1</Text>
              </View>
              <View style={[styles.progressLine, { backgroundColor: '#0d9488', flex: 1 }]} />
              <View style={styles.progressLine} />
              <View style={[styles.progressDot, { backgroundColor: '#e2e8f0' }]}>
                <Text style={[styles.progressDotText, { color: '#94a3b8' }]}>2</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>Link Your Delivery Platform</Text>
            <Text style={styles.subtitle}>
              Connect your delivery account to enable real-time monitoring and automatic payouts.
            </Text>

            {/* Platform Cards */}
            <View style={styles.platformGrid}>
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatform === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.platformCard,
                      isSelected && { borderColor: p.color, backgroundColor: `${p.color}18` },
                    ]}
                    onPress={() => setSelectedPlatform(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.platformEmoji}>{p.emoji}</Text>
                    <Text style={[styles.platformName, isSelected && { color: p.color }]}>{p.name}</Text>
                    {isSelected && <Text style={[styles.selectedTick, { color: p.color }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional code input */}
            {selectedPlatform && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Partner ID / Platform Code (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Your ${selectedPlatform} partner ID`}
                  placeholderTextColor="#94a3b8"
                  value={platformCode}
                  onChangeText={setPlatformCode}
                />
                <Text style={styles.inputHint}>Find this in your partner app settings or leave blank.</Text>
              </View>
            )}

            {/* Success */}
            {success && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ Platform Linked! Proceeding to payment setup...</Text>
              </View>
            )}

            {/* CTA Button */}
            <TouchableOpacity
              style={[styles.btn, (!selectedPlatform || loading || success) && styles.btnDisabled]}
              onPress={handleLink}
              disabled={!selectedPlatform || loading || success}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Link Platform & Continue →</Text>
              )}
            </TouchableOpacity>

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
  scroll: { padding: 20, paddingBottom: 40 },

  banner: {
    backgroundColor: '#0d9488',
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
  },
  bannerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressLine: {
    height: 3,
    backgroundColor: '#e2e8f0',
    flex: 1,
    marginHorizontal: 4,
  },

  title: { fontSize: 20, fontWeight: '700', color: '#134e4a', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#0f766e', marginBottom: 24, lineHeight: 20 },

  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  platformCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  platformEmoji: { fontSize: 32, marginBottom: 8 },
  platformName: { fontSize: 14, fontWeight: '600', color: '#134e4a' },
  selectedTick: {
    position: 'absolute',
    top: 8,
    right: 12,
    fontSize: 16,
    fontWeight: '700',
  },

  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#134e4a', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#134e4a',
  },
  inputHint: { fontSize: 11, color: '#64748b', marginTop: 4 },

  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  successText: { fontSize: 14, color: '#15803d', fontWeight: '600' },

  btn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#94a3b8' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

export default OnboardingStep1Screen;
