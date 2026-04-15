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
          // /api/auth/me returns user doc directly OR may have .worker wrapper
          const w = userData.worker || userData;
          const isWorker = (w.userType === 'worker') || !!userData.worker;
          setUser({
            id: w._id || w.id,
            email: w.email,
            fullName: w.fullName,
            phoneNumber: w.phoneNumber,
            role: isWorker ? 'worker' : 'admin',
            platform: w.platform,
            onboardingStep: w.onboardingStep ?? 1,
            onboardingCompleted: w.onboardingCompleted ?? false,
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
      const w = userData.worker || userData;
      setUser(prev => prev ? {
        ...prev,
        platform: w.platform ?? prev.platform,
        onboardingStep: w.onboardingStep ?? prev.onboardingStep,
        onboardingCompleted: w.onboardingCompleted ?? prev.onboardingCompleted,
      } : null);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const workerSignUp = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    setLoading(true);
    try {
      const response = await apiService.workerSignUp(email, password, fullName, phoneNumber);
      const u = response.user || response;
      setUser({
        id: u.id || u._id || response.workerId,
        email: u.email || email,
        fullName: u.fullName || fullName,
        phoneNumber: u.phoneNumber || phoneNumber,
        role: 'worker',
        onboardingStep: u.onboardingStep ?? 1,
        onboardingCompleted: u.onboardingCompleted ?? false,
      });
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const workerSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiService.workerSignIn(email, password);
      const u = response.user || response;
      setUser({
        id: u.id || u._id || response.workerId,
        email: u.email || email,
        fullName: u.fullName || '',
        phoneNumber: u.phoneNumber || '',
        role: 'worker',
        platform: u.platform,
        onboardingStep: u.onboardingStep ?? 1,
        onboardingCompleted: u.onboardingCompleted ?? false,
      });
    } catch (err) {
      throw err;
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
