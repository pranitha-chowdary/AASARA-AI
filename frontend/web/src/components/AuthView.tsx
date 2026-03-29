import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Bike, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AasaraLogo } from './AasaraLogo';

type AuthTab = 'admin' | 'worker';
type WorkerMode = 'login' | 'signup';

export function AuthView() {
  const [activeTab, setActiveTab] = useState<AuthTab>('worker');
  const [workerMode, setWorkerMode] = useState<WorkerMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  const { signInWithEmail, signUpWorker, signInWorker, signInAdmin } = useAuth();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInAdmin(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (workerMode === 'signup') {
        await signUpWorker(email, password, fullName, phoneNumber);
      } else {
        await signInWorker(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AasaraLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-teal-600 mb-2">Aasara AI</h1>
          <p className="text-slate-500">Parametric Safety Net for Gig Workers</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('worker')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 transition-all ${
                activeTab === 'worker'
                  ? 'bg-white text-teal-600 border-b-2 border-teal-500 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              <Bike className="w-5 h-5" />
              <span>Gig Worker</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 transition-all ${
                activeTab === 'admin'
                  ? 'bg-white text-teal-600 border-b-2 border-teal-500 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Admin</span>
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'admin' ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                      placeholder="admin@aasara.ai"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                {error && (
                  <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
                  <button
                    onClick={() => {
                      setWorkerMode('signup');
                      setOtpSent(false);
                      setError('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      workerMode === 'signup'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={() => {
                      setWorkerMode('login');
                      setOtpSent(false);
                      setError('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      workerMode === 'login'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Login
                  </button>
                </div>

                <form onSubmit={handleWorkerAuth} className="space-y-4">
                  {workerMode === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                          placeholder="Enter your full name"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                  </div>

                  {workerMode === 'signup' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                          placeholder="+91 9876543210"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
                        placeholder={workerMode === 'signup' ? 'Min. 8 characters' : '••••••••'}
                        required
                      />
                    </div>
                    {workerMode === 'signup' && (
                      <p className="text-slate-500 text-xs mt-1">Password must be at least 8 characters</p>
                    )}
                  </div>

                  {error && (
                    <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm"
                  >
                    {loading
                      ? 'Processing...'
                      : workerMode === 'signup'
                      ? 'Sign Up'
                      : 'Sign In'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Powered by Aasara AI • Industrial Fintech Platform
        </p>
      </motion.div>
    </div>
  );
}
