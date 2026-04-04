import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  const host = hostUri?.split(':')?.[0];
  if (host && host !== 'localhost') {
    return `http://${host}:5001/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001/api';
  }

  return 'http://localhost:5001/api';
};

const API_URL = getApiUrl();

class ApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_URL,
      timeout: 15000,
    });

    this.axiosInstance.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async workerSignUp(email: string, password: string, fullName: string, phoneNumber: string) {
    const response = await this.axiosInstance.post('/auth/signup', {
      email: email.toLowerCase().trim(),
      password,
      fullName,
      phoneNumber,
    });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  async workerSignIn(email: string, password: string) {
    const response = await this.axiosInstance.post('/auth/signin', {
      email: email.toLowerCase().trim(),
      password,
    });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  async adminLogin(email: string, password: string) {
    const response = await this.axiosInstance.post('/admin/login', {
      email: email.toLowerCase().trim(),
      password,
    });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.axiosInstance.get('/auth/me');
    return response.data;
  }

  async getAllWorkers() {
    const response = await this.axiosInstance.get('/admin/workers');
    return response.data.workers || [];
  }

  async checkActiveDisruption() {
    try {
      const response = await this.axiosInstance.get('/disruption/check-active');
      return response.data.disruption;
    } catch (error) {
      return null;
    }
  }

  async triggerDisruption(workerId: string, disruptionType: string, severity: string = 'high') {
    const response = await this.axiosInstance.post('/admin/trigger-disruption', {
      workerId,
      disruptionType,
      severity,
    });
    return response.data;
  }

  async simulateBlackSwan(params: { days?: number; disruptionType?: string }) {
    const response = await this.axiosInstance.post('/admin/black-swan-simulation', params);
    return response.data;
  }

  async getAdminClaims() {
    const response = await this.axiosInstance.get('/admin/claims');
    return response.data;
  }

  async getActiveSubscription() {
    try {
      const response = await this.axiosInstance.get('/subscription/get-active');
      return response.data.subscription;
    } catch (error) {
      return null;
    }
  }

  async toggleShiftStatus(isOnline: boolean) {
    const response = await this.axiosInstance.post('/shifts/toggle-status', { isOnline });
    return response.data;
  }

  async getShiftStatus() {
    try {
      const response = await this.axiosInstance.get('/shifts/current-status');
      return response.data;
    } catch (error) {
      return { isOnline: false };
    }
  }

  async sendHeartbeat() {
    try {
      await this.axiosInstance.post('/heartbeat');
    } catch (error) {
      // silent
    }
  }

  async fetchClaimsHistory() {
    try {
      const response = await this.axiosInstance.get('/claims/my-claims');
      return response.data.claims || [];
    } catch (error) {
      return [];
    }
  }

  async fetchNotifications() {
    try {
      const response = await this.axiosInstance.get('/notifications');
      return response.data;
    } catch (error) {
      return { notifications: [], unreadCount: 0 };
    }
  }

  async markNotificationsRead() {
    try {
      await this.axiosInstance.post('/notifications/read');
    } catch (error) {
      // silent
    }
  }

  async verifyAnomaly(mockResult: string) {
    const response = await this.axiosInstance.post('/claims/verify-anomaly', { mockResult });
    return response.data;
  }

  async linkPlatform(platform: string, platformCode?: string) {
    const response = await this.axiosInstance.post('/onboarding/link-platform', {
      platform,
      platformCode: platformCode || null,
    });
    return response.data;
  }

  async getPremiumQuote(startDate: string, endDate: string, lat: number, lng: number) {
    const response = await this.axiosInstance.post('/onboarding/premium-quote', {
      startDate, endDate, lat, lng,
    });
    return response.data;
  }

  async createOrder(amount: number, plan: object) {
    const response = await this.axiosInstance.post('/onboarding/create-order', { amount, plan });
    return response.data;
  }

  async verifyPayment(orderId: string, paymentId: string, signature: string, planDetails: object) {
    const response = await this.axiosInstance.post('/onboarding/verify-payment', {
      orderId, paymentId, signature, planDetails,
    });
    return response.data;
  }

  async simulatePayment(planDetails: object) {
    // Expo Go compatible: simulates payment by calling verify-payment with test data
    const response = await this.axiosInstance.post('/onboarding/verify-payment', {
      orderId: `order_SIMULATED_${Date.now()}`,
      paymentId: `pay_SIMULATED_${Date.now()}`,
      signature: `sig_SIMULATED_${Date.now()}`,
      planDetails,
      simulated: true,
    });
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.axiosInstance.post('/auth/forgot-password', {
      email: email.toLowerCase().trim(),
    });
    return response.data;
  }

  async runTriggerScan(lat: number, lng: number) {
    const response = await this.axiosInstance.post('/admin/run-trigger-scan', { lat, lng });
    return response.data;
  }

  async processClaim(claimId: string, action: 'approve' | 'reject') {
    const response = await this.axiosInstance.post('/admin/process-claim', { claimId, action });
    return response.data;
  }

  async platformLookup(workerId: string) {
    const response = await this.axiosInstance.post('/admin/platform-lookup', { workerId });
    return response.data;
  }

  async triggerSyndicate(workerId: string, disruptionType: string) {
    const response = await this.axiosInstance.post('/admin/trigger-syndicate', {
      workerId,
      disruptionType,
    });
    return response.data;
  }

  async getAdminAnalytics() {
    const response = await this.axiosInstance.get('/admin/analytics');
    return response.data;
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
  }
}

export const apiService = new ApiService();
