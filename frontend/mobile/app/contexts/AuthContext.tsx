import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface User {
  id: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  role: 'worker' | 'admin';
  platform?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initializing: boolean;
  isWorker: boolean;
  isAdmin: boolean;
  workerSignUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<void>;
  workerSignIn: (email: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getStoredToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Restore session on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          const userData = await apiService.getCurrentUser();
          setUser({
            id: userData.worker?._id || userData.worker?.id || userData.admin?._id || userData.id,
            email: userData.worker?.email || userData.admin?.email || userData.email,
            fullName: userData.worker?.fullName || userData.admin?.fullName,
            phoneNumber: userData.worker?.phoneNumber,
            role: userData.worker ? 'worker' : 'admin',
            platform: userData.worker?.platform,
            onboardingStep: userData.worker?.onboardingStep || 1,
            onboardingCompleted: userData.worker?.onboardingCompleted || false,
          });
        }
      } catch (error) {
        // Token invalid — clear it
        await AsyncStorage.removeItem('authToken');
      } finally {
        setInitializing(false);
      }
    };
    checkAuth();
  }, []);

  const refreshUser = async () => {
    try {
      const userData = await apiService.getCurrentUser();
      setUser(prev => prev ? {
        ...prev,
        platform: userData.worker?.platform,
        onboardingStep: userData.worker?.onboardingStep || prev.onboardingStep,
        onboardingCompleted: userData.worker?.onboardingCompleted || prev.onboardingCompleted,
      } : null);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const workerSignUp = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    setLoading(true);
    try {
      const response = await apiService.workerSignUp(email, password, fullName, phoneNumber);
      setUser({
        id: response.workerId || response.id,
        email,
        fullName,
        phoneNumber,
        role: 'worker',
        onboardingStep: 1,
        onboardingCompleted: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const workerSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiService.workerSignIn(email, password);
      setUser({
        id: response.workerId || response.id,
        email,
        fullName: response.fullName || '',
        phoneNumber: response.phoneNumber || '',
        role: 'worker',
        platform: response.platform,
        onboardingStep: response.onboardingStep || 1,
        onboardingCompleted: response.onboardingCompleted || false,
      });
    } finally {
      setLoading(false);
    }
  };

  const adminLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiService.adminLogin(email, password);
      setUser({
        id: response.adminId || response.id,
        email,
        role: 'admin',
      });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getStoredToken = async () => {
    return await AsyncStorage.getItem('authToken');
  };

  const value: AuthContextType = {
    user,
    loading,
    initializing,
    isWorker: user?.role === 'worker',
    isAdmin: user?.role === 'admin',
    workerSignUp,
    workerSignIn,
    adminLogin,
    logout,
    getStoredToken,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
