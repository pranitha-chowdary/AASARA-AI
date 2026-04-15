import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

type AuthTab = 'worker' | 'admin';
type WorkerMode = 'signup' | 'login' | 'forgot-password';

const LoginScreen: React.FC = () => {
  const { workerSignUp, workerSignIn, adminLogin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>('worker');
  const [workerMode, setWorkerMode] = useState<WorkerMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  const clearMessages = () => { setError(''); setSuccessMsg(''); };

  const handleWorkerAuth = async () => {
    clearMessages();
    if (workerMode === 'forgot-password') {
      if (!email) { setError('Please enter your email address'); return; }
      if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return; }
      try {
        await apiService.forgotPassword(email);
        setSuccessMsg('Password reset link sent! Check your email inbox.');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to send reset link.');
      }
      return;
    }
    if (workerMode === 'signup') {
      if (!fullName || !email || !password || !phoneNumber) { setError('Please fill in all fields'); return; }
      if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return; }
      if (!/^[6-9]\d{9}$/.test(phoneNumber)) { setError('Enter a valid 10-digit mobile number starting with 6-9'); return; }
      try { await workerSignUp(email, password, fullName, phoneNumber); }
      catch (err: any) { setError(err?.response?.data?.error || err?.response?.data?.message || 'Sign up failed.'); }
    } else {
      if (!email || !password) { setError('Please fill in all fields'); return; }
      if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return; }
      try { await workerSignIn(email, password); }
      catch (err: any) { setError(err?.response?.data?.error || err?.response?.data?.message || 'Sign in failed.'); }
    }
  };

  const handleAdminLogin = async () => {
    clearMessages();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return; }
    try { await adminLogin(email, password); }
    catch (err: any) { setError(err?.response?.data?.error || err?.response?.data?.message || 'Admin login failed.'); }
  };

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab); clearMessages();
    setEmail(''); setPassword(''); setFullName(''); setPhoneNumber('');
  };

  const switchWorkerMode = (mode: WorkerMode) => { setWorkerMode(mode); clearMessages(); };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" />
        <View style={styles.loadingSpinnerWrap}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
        <Text style={styles.loadingText}>
          {workerMode === 'signup' ? 'Creating your account...' : 'Signing you in...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Branding */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={36} color="#0d9488" />
            </View>
            <Text style={styles.brandName}>Aasara AI</Text>
            <Text style={styles.brandTagline}>Parametric Safety Net for Gig Workers</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.authCard}>
            {/* Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'worker' && styles.tabButtonActive]} onPress={() => switchTab('worker')}>
                <MaterialCommunityIcons name="bike-fast" size={18} color={activeTab === 'worker' ? '#0d9488' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, activeTab === 'worker' && styles.tabButtonTextActive]}>Gig Worker</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabButton, activeTab === 'admin' && styles.tabButtonActive]} onPress={() => switchTab('admin')}>
                <Ionicons name="shield" size={17} color={activeTab === 'admin' ? '#0d9488' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, activeTab === 'admin' && styles.tabButtonTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formArea}>
              {activeTab === 'admin' ? (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                      <TextInput style={styles.textInput} placeholder="admin@aasara.ai" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                      <TextInput style={[styles.textInput, { flex: 1 }]} placeholder="Enter your password" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {/* Sign Up / Login toggle */}
                  <View style={styles.modeToggle}>
                    <TouchableOpacity style={[styles.modeBtn, workerMode === 'signup' && styles.modeBtnActive]} onPress={() => switchWorkerMode('signup')}>
                      <Text style={[styles.modeBtnText, workerMode === 'signup' && styles.modeBtnTextActive]}>Sign Up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modeBtn, (workerMode === 'login' || workerMode === 'forgot-password') && styles.modeBtnActive]} onPress={() => switchWorkerMode('login')}>
                      <Text style={[styles.modeBtnText, (workerMode === 'login' || workerMode === 'forgot-password') && styles.modeBtnTextActive]}>Login</Text>
                    </TouchableOpacity>
                  </View>

                  {workerMode === 'forgot-password' ? (
                    <>
                      <Text style={styles.forgotDesc}>Enter your registered email address and we'll send you a link to reset your password.</Text>
                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                          <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                          <TextInput style={styles.textInput} placeholder="you@example.com" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      {workerMode === 'signup' && (
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Full Name</Text>
                          <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput style={styles.textInput} placeholder="Enter your full name" placeholderTextColor="#94a3b8" value={fullName} onChangeText={setFullName} />
                          </View>
                        </View>
                      )}

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <View style={styles.inputWrapper}>
                          <Ionicons name="mail-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                          <TextInput style={styles.textInput} placeholder="you@example.com" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                        </View>
                      </View>

                      {workerMode === 'signup' && (
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Phone Number</Text>
                          <View style={styles.inputWrapper}>
                            <Ionicons name="call-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput style={styles.textInput} placeholder="9876543210" placeholderTextColor="#94a3b8" value={phoneNumber} onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))} keyboardType="phone-pad" maxLength={10} />
                          </View>
                        </View>
                      )}

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                          <Text style={styles.inputLabel}>Password</Text>
                          {workerMode === 'login' && (
                            <TouchableOpacity onPress={() => switchWorkerMode('forgot-password')}>
                              <Text style={styles.forgotLink}>Forgot Password?</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.inputWrapper}>
                          <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
                          <TextInput style={[styles.textInput, { flex: 1 }]} placeholder={workerMode === 'signup' ? 'Min 8 chars, Upper, Number, Special' : '••••••••'} placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                          </TouchableOpacity>
                        </View>
                        {workerMode === 'signup' && <Text style={styles.fieldHint}>Must contain uppercase, number, and special character</Text>}
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Messages */}
              {successMsg !== '' && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#15803d" />
                  <Text style={styles.successBannerText}>{successMsg}</Text>
                </View>
              )}
              {error !== '' && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity style={styles.submitBtn} onPress={activeTab === 'admin' ? handleAdminLogin : handleWorkerAuth} activeOpacity={0.85}>
                <Text style={styles.submitBtnText}>
                  {activeTab === 'admin' ? 'Sign In' : workerMode === 'signup' ? 'Create Account' : workerMode === 'forgot-password' ? 'Send Reset Link' : 'Sign In'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              {workerMode === 'forgot-password' && (
                <TouchableOpacity style={styles.backToLoginBtn} onPress={() => switchWorkerMode('login')}>
                  <Ionicons name="arrow-back" size={16} color="#0d9488" />
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.footer}>Powered by Aasara AI • Industrial Fintech Platform</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdfa' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 30, paddingBottom: 40, justifyContent: 'center' },
  loadingContainer: { flex: 1, backgroundColor: '#f0fdfa', justifyContent: 'center', alignItems: 'center' },
  loadingSpinnerWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 15, color: '#0f766e', fontWeight: '500', marginTop: 16 },

  brandSection: { alignItems: 'center', marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  brandName: { fontSize: 28, fontWeight: '800', color: '#0f766e', letterSpacing: -0.5 },
  brandTagline: { fontSize: 13, color: '#5eead4', fontWeight: '600', marginTop: 4 },

  authCard: { backgroundColor: '#fff', borderRadius: 20, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#e0f2fe' },

  tabRow: { flexDirection: 'row', backgroundColor: '#f0fdfa', borderBottomWidth: 1, borderBottomColor: '#e0f2fe' },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 6, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabButtonActive: { backgroundColor: '#fff', borderBottomColor: '#0d9488' },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabButtonTextActive: { color: '#0d9488', fontWeight: '700' },

  formArea: { padding: 20, gap: 14 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 14, fontWeight: '500', color: '#94a3b8' },
  modeBtnTextActive: { color: '#0f766e', fontWeight: '700' },

  inputGroup: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 15, color: '#1e293b', paddingVertical: Platform.OS === 'ios' ? 13 : 10 },
  eyeBtn: { padding: 4 },
  fieldHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  forgotLink: { fontSize: 12, color: '#0d9488', fontWeight: '600' },
  forgotDesc: { fontSize: 13, color: '#64748b', lineHeight: 19 },

  successBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10, padding: 12, gap: 8 },
  successBannerText: { fontSize: 13, color: '#15803d', fontWeight: '500', flex: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, gap: 8 },
  errorBannerText: { fontSize: 13, color: '#dc2626', fontWeight: '500', flex: 1 },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d9488', paddingVertical: 15, borderRadius: 14, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  backToLoginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderWidth: 1, borderColor: '#e0f2fe', borderRadius: 12, gap: 6 },
  backToLoginText: { fontSize: 14, color: '#0d9488', fontWeight: '600' },

  footer: { textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 24, fontWeight: '500' },
});

export default LoginScreen;
