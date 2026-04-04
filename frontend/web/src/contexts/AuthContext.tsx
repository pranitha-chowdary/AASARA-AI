import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  userType: 'worker' | 'admin';
}

interface AuthContextType {
  user: User | null;
  userType: 'admin' | 'worker' | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWorker: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<void>;
  signInWorker: (email: string, password: string) => Promise<void>;
  signInAdmin: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  workerProfile: any;
  refreshWorkerProfile: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001') + '/api';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'admin' | 'worker' | null>(null);
  const [loading, setLoading] = useState(true);
  const [workerProfile, setWorkerProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));

  const clearError = () => setError(null);

  const refreshWorkerProfile = async () => {
    if (!user) return;
    setWorkerProfile({
      userId: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
    });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          if (response.ok) {
            const userData = await response.json();
            setUser({
              id: userData._id,
              email: userData.email,
              fullName: userData.fullName,
              phoneNumber: userData.phoneNumber,
              userType: userData.userType,
            });
            setUserType(userData.userType);
            setToken(storedToken);
            setWorkerProfile({
              userId: userData._id,
              fullName: userData.fullName,
              phoneNumber: userData.phoneNumber,
            });
          } else {
            localStorage.removeItem('authToken');
          }
        } catch (err) {
          console.error('Auth check error:', err);
          localStorage.removeItem('authToken');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      clearError();

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          throw new Error('Invalid email or password');
        }
        throw new Error(errorData.error || 'Sign in failed');
      }

      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        phoneNumber: data.user.phoneNumber,
        userType: data.user.userType,
      });
      setUserType(data.user.userType);
      setWorkerProfile({
        userId: data.user.id,
        fullName: data.user.fullName,
        phoneNumber: data.user.phoneNumber,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Sign in failed. Please try again.';
      setError(errorMessage);
      console.error('SignIn Error:', errorMessage);
      throw err;
    }
  };

  const signInAdmin = async (email: string, password: string) => {
    try {
      clearError();

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      console.log('🔐 Admin Login Attempt:', email);
      console.log('📍 API URL:', `${API_URL}/admin/login`);

      const response = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
        }),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        if (response.status === 401) {
          throw new Error('Invalid admin email or password');
        }
        throw new Error((errorData as any).error || `Admin login failed (${response.status})`);
      }

      const data = await response.json();
      console.log('✅ Admin login successful!');
      console.log('📦 Response data:', data);
      
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('authToken', data.token); // Also set as authToken for context
      setToken(data.token);
      setUser({
        id: data.admin.id,
        email: data.admin.email,
        fullName: 'Admin',
        phoneNumber: '',
        userType: 'admin',
      });
      setUserType('admin');
    } catch (err: any) {
      const errorMessage = err.message || 'Admin login failed. Please try again. Check console for details.';
      setError(errorMessage);
      console.error('❌ Admin SignIn Error:', errorMessage);
      console.error('❌ Full error:', err);
      throw err;
    }
  };

  const signUpWorker = async (email: string, password: string, fullName: string, phoneNumber: string) => {
    try {
      clearError();

      if (!email || !password || !fullName || !phoneNumber) {
        throw new Error('All fields are required');
      }

      if (!email.includes('@')) {
        throw new Error('Please enter a valid email address');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      if (fullName.length < 2) {
        throw new Error('Full name must be at least 2 characters');
      }

      if (phoneNumber.length < 10) {
        throw new Error('Please enter a valid phone number');
      }

      console.log('Signing up worker:', { email, fullName, phoneNumber });

      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          fullName,
          phoneNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error('Email or phone number already exists');
        }
        throw new Error(errorData.error || 'Sign up failed');
      }

      const data = await response.json();
      console.log('User created:', data.user.id);

      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      setUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        phoneNumber: data.user.phoneNumber,
        userType: data.user.userType,
      });
      setUserType(data.user.userType);
      setWorkerProfile({
        userId: data.user.id,
        fullName: data.user.fullName,
        phoneNumber: data.user.phoneNumber,
      });

      console.log('Worker profile created successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Signup failed. Please try again.';
      setError(errorMessage);
      console.error('SignUp Error:', errorMessage);
      throw err;
    }
  };

  const signInWorker = async (email: string, password: string) => {
    return signInWithEmail(email, password);
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('authToken');
      setToken(null);
      setUser(null);
      setUserType(null);
      setWorkerProfile(null);
      clearError();
    } catch (err) {
      console.error('SignOut Error:', err);
    }
  };

  const value = {
    user,
    userType,
    loading,
    signInWithEmail,
    signUpWorker,
    signInWorker,
    signInAdmin,
    signOut,
    workerProfile,
    refreshWorkerProfile,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
