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
  ImageBackground,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

type Tab = 'worker_signup' | 'worker_signin' | 'admin';

const LoginScreen: React.FC = () => {
  const { workerSignUp, workerSignIn, adminLogin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('worker_signin');

  // Worker signup
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Worker signin
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  // Admin
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Local error messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

  const handleWorkerSignUp = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!signupEmail || !signupPassword || !fullName || !phoneNumber) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (!emailRegex.test(signupEmail)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setErrorMsg('Please enter a valid 10-digit mobile number starting with 6-9');
      return;
    }
    try {
      await workerSignUp(signupEmail, signupPassword, fullName, phoneNumber);
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.message || 'Sign up failed. Please try again.');
    }
  };

  const handleWorkerSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!signinEmail || !signinPassword) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (!emailRegex.test(signinEmail)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    try {
      await workerSignIn(signinEmail, signinPassword);
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.message || 'Sign in failed. Please try again.');
    }
  };

  const handleAdminLogin = async () => {
    setErrorMsg('');
    if (!adminEmail || !adminPassword) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (!emailRegex.test(adminEmail)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    try {
      await adminLogin(adminEmail, adminPassword);
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.message || 'Admin login failed.');
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail) {
      setForgotError('Please enter your email address');
      return;
    }
    if (!emailRegex.test(forgotEmail)) {
      setForgotError('Please enter a valid email address');
      return;
    }
    try {
      setForgotLoading(true);
      await apiService.forgotPassword(forgotEmail);
      setForgotSuccess('Password reset link sent! Check your email inbox.');
    } catch (error: any) {
      setForgotError(error?.response?.data?.message || 'Failed to send reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setErrorMsg('');
    setSuccessMsg('');
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSuccess('');
    setForgotError('');
  };

  if (loading) {
    return (
      <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={activeTab === 'admin' ? '#f97316' : '#0d9488'} />
              <Text style={styles.loadingText}>
                {activeTab === 'worker_signup' ? 'Creating account...' : activeTab === 'admin' ? 'Admin login...' : 'Signing in...'}
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
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Aasara</Text>
              <Text style={styles.subtitle}>Delivery Safety Platform</Text>
            </View>

            {/* Tab Buttons */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'worker_signup' && styles.activeTab]}
                onPress={() => switchTab('worker_signup')}
              >
                <Text style={[styles.tabText, activeTab === 'worker_signup' && styles.activeTabText]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'worker_signin' && styles.activeTab]}
                onPress={() => switchTab('worker_signin')}
              >
                <Text style={[styles.tabText, activeTab === 'worker_signin' && styles.activeTabText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'admin' && styles.activeTab]}
                onPress={() => switchTab('admin')}
              >
                <Text style={[styles.tabText, activeTab === 'admin' && styles.activeTabText]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            {/* Global error/success messages */}
            {errorMsg !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>⚠️ {errorMsg}</Text>
              </View>
            )}
            {successMsg !== '' && (
              <View style={styles.successBox}>
                <Text style={styles.successBoxText}>✅ {successMsg}</Text>
              </View>
            )}

            {/* ===== FORGOT PASSWORD MODE ===== */}
            {showForgotPassword && activeTab === 'worker_signin' && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Reset Password</Text>
                <Text style={styles.formSubtitle}>
                  Enter your registered email and we'll send a reset link.
                </Text>

                {forgotError !== '' && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>⚠️ {forgotError}</Text>
                  </View>
                )}
                {forgotSuccess !== '' && (
                  <View style={styles.successBox}>
                    <Text style={styles.successBoxText}>✅ {forgotSuccess}</Text>
                  </View>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Your registered email"
                  placeholderTextColor="#aaa"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[styles.button, styles.greenButton, forgotLoading && styles.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  {forgotLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.buttonText}>Send Reset Link</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowForgotPassword(false);
                    setForgotEmail('');
                    setForgotSuccess('');
                    setForgotError('');
                  }}
                >
                  <Text style={styles.linkText}>← Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== WORKER SIGN UP ===== */}
            {activeTab === 'worker_signup' && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Create Account</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#aaa"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#aaa"
                  value={signupEmail}
                  onChangeText={setSignupEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number (10 digits, starts 6–9)"
                  placeholderTextColor="#aaa"
                  value={phoneNumber}
                  onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 chars, 1 Uppercase, 1 Number, 1 Special"
                  placeholderTextColor="#aaa"
                  value={signupPassword}
                  onChangeText={setSignupPassword}
                  secureTextEntry
                />
                <Text style={styles.fieldHint}>
                  Must contain an uppercase letter, number, and special character
                </Text>
                <TouchableOpacity style={[styles.button, styles.greenButton]} onPress={handleWorkerSignUp}>
                  <Text style={styles.buttonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== WORKER SIGN IN ===== */}
            {activeTab === 'worker_signin' && !showForgotPassword && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Welcome Back</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#aaa"
                  value={signinEmail}
                  onChangeText={setSigninEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  value={signinPassword}
                  onChangeText={setSigninPassword}
                  secureTextEntry
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowForgotPassword(true);
                    setForgotEmail(signinEmail);
                    setErrorMsg('');
                  }}
                >
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.greenButton]} onPress={handleWorkerSignIn}>
                  <Text style={styles.buttonText}>Sign In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ===== ADMIN LOGIN ===== */}
            {activeTab === 'admin' && (
              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Admin Access</Text>
                <Text style={styles.adminHint}>Demo credentials: admin@aasara.ai / admin123456</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Admin Email"
                  placeholderTextColor="#aaa"
                  value={adminEmail}
                  onChangeText={setAdminEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Admin Password"
                  placeholderTextColor="#aaa"
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                />
                <TouchableOpacity style={[styles.button, styles.orangeButton]} onPress={handleAdminLogin}>
                  <Text style={styles.buttonText}>Admin Login</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0d9488',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#134e4a',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#99f6e4',
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#0d9488',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0d9488',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorBoxText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successBoxText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '600',
  },
  formContainer: {
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.20)',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134e4a',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: '#99f6e4',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#134e4a',
  },
  fieldHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: -6,
    paddingHorizontal: 4,
  },
  forgotLink: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -6,
  },
  linkText: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 48,
  },
  greenButton: {
    backgroundColor: '#0d9488',
  },
  orangeButton: {
    backgroundColor: '#f97316',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  adminHint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#134e4a',
  },
});

export default LoginScreen;
