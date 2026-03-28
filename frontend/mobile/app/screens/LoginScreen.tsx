import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

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

  const handleWorkerSignUp = async () => {
    if (!signupEmail || !signupPassword || !fullName || !phoneNumber) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await workerSignUp(signupEmail, signupPassword, fullName, phoneNumber);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error?.response?.data?.message || 'An error occurred');
    }
  };

  const handleWorkerSignIn = async () => {
    if (!signinEmail || !signinPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await workerSignIn(signinEmail, signinPassword);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error?.response?.data?.message || 'An error occurred');
    }
  };

  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await adminLogin(adminEmail, adminPassword);
    } catch (error: any) {
      Alert.alert('Admin Login Failed', error?.response?.data?.message || 'An error occurred');
    }
  };

  if (loading && activeTab === 'worker_signup') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Creating account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && activeTab === 'worker_signin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Signing in...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && activeTab === 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Admin login...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Aasara</Text>
          <Text style={styles.subtitle}>Delivery Safety Platform</Text>
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'worker_signup' && styles.activeTab]}
            onPress={() => setActiveTab('worker_signup')}
          >
            <Text style={[styles.tabText, activeTab === 'worker_signup' && styles.activeTabText]}>
              Sign Up
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'worker_signin' && styles.activeTab]}
            onPress={() => setActiveTab('worker_signin')}
          >
            <Text style={[styles.tabText, activeTab === 'worker_signin' && styles.activeTabText]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'admin' && styles.activeTab]}
            onPress={() => setActiveTab('admin')}
          >
            <Text style={[styles.tabText, activeTab === 'admin' && styles.activeTabText]}>
              Admin
            </Text>
          </TouchableOpacity>
        </View>

        {/* Worker Sign Up Tab */}
        {activeTab === 'worker_signup' && (
          <View style={styles.formContainer}>
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
              placeholder="Phone Number"
              placeholderTextColor="#aaa"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#aaa"
              value={signupPassword}
              onChangeText={setSignupPassword}
              secureTextEntry
            />
            <TouchableOpacity style={[styles.button, styles.greenButton]} onPress={handleWorkerSignUp}>
              <Text style={styles.buttonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Worker Sign In Tab */}
        {activeTab === 'worker_signin' && (
          <View style={styles.formContainer}>
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
            <TouchableOpacity style={[styles.button, styles.greenButton]} onPress={handleWorkerSignIn}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Admin Login Tab */}
        {activeTab === 'admin' && (
          <View style={styles.formContainer}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#10b981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#10b981',
  },
  formContainer: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#f1f5f9',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  greenButton: {
    backgroundColor: '#10b981',
  },
  orangeButton: {
    backgroundColor: '#f97316',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  adminHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
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
    color: '#cbd5e1',
  },
});

export default LoginScreen;
