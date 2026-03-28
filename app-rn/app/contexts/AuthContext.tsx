import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface User {
  id: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  role: 'worker' | 'admin';
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isWorker: boolean;
  isAdmin: boolean;
  workerSignUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<void>;
  workerSignIn: (email: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getStoredToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // Check for stored token on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          // Optionally verify token by fetching user
          // const userData = await apiService.getCurrentUser();
          // setUser(userData);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    checkAuth();
  }, []);

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
    isWorker: user?.role === 'worker',
    isAdmin: user?.role === 'admin',
    workerSignUp,
    workerSignIn,
    adminLogin,
    logout,
    getStoredToken,
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
