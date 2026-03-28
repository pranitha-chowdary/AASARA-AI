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

  // Android emulator needs 10.0.2.2 instead of localhost
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
      timeout: 10000,
    });

    // Add token to requests
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

  async getActiveSubscription() {
    try {
      const response = await this.axiosInstance.get('/subscription/get-active');
      return response.data.subscription;
    } catch (error) {
      return null;
    }
  }

  async logout() {
    await AsyncStorage.removeItem('authToken');
  }
}

export const apiService = new ApiService();
