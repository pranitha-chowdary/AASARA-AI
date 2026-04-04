import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Bike, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AasaraLogo } from './AasaraLogo';

type AuthTab = 'admin' | 'worker';
type WorkerMode = 'login' | 'signup' | 'forgot-password';

export function AuthView() {
  const [activeTab, setActiveTab] = useState<AuthTab>('worker');
  const [workerMode, setWorkerMode] = useState<WorkerMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
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
    setSuccessMsg('');
    setLoading(true);

    try {
      if (workerMode === 'signup') {
        await signUpWorker(email, password, fullName, phoneNumber);
      } else if (workerMode === 'login') {
        await signInWorker(email, password);
      } else if (workerMode === 'forgot-password') {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(data.message);
        } else {
          setError(data.error || 'Request failed');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <AasaraLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold text-teal-700 mb-2">Aasara AI</h1>
          <p className="text-teal-600/80 font-medium">Parametric Safety Net for Gig Workers</p>
        </div>

        <div className="bg-white/88 backdrop-blur-md rounded-2xl border border-teal-100/80 shadow-xl shadow-teal-900/10 overflow-hidden">
          <div className="flex border-b border-teal-100 bg-teal-50/40">
            <button
              onClick={() => setActiveTab('worker')}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 transition-all ${
                activeTab === 'worker'
                  ? 'bg-white text-teal-600 border-b-2 border-teal-500 font-bold'
                  : 'text-teal-600/70 hover:text-teal-800 hover:bg-teal-50/60'
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
                  : 'text-teal-600/70 hover:text-teal-800 hover:bg-teal-50/60'
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
                      className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
                      placeholder="admin@aasara.ai"
                      pattern="^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$"
                      title="Please enter a valid email address"
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
                    className="w-full px-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
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
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md shadow-teal-200"
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
                        : 'text-teal-600/60 hover:text-teal-800'
                    }`}
                  >
                    Sign Up
                  </button>
                  <button
                    onClick={() => {
                      setWorkerMode('login');
                      setOtpSent(false);
                      setError('');
                      setSuccessMsg('');
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                      workerMode === 'login' || workerMode === 'forgot-password'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-teal-600/60 hover:text-teal-800'
                    }`}
                  >
                    Login
                  </button>
                </div>

                <form onSubmit={handleWorkerAuth} className="space-y-4">
                  {workerMode === 'forgot-password' ? (
                    <div className="mb-4">
                      <p className="text-sm text-slate-600 mb-4">
                        Enter your registered email address and we'll send you a link to reset your password.
                      </p>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <>
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
                              className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
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
                            className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
                            placeholder="you@example.com"
                            pattern="^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$"
                            title="Please enter a valid email address"
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
                              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                              maxLength={10}
                              className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
                              placeholder="9876543210"
                              pattern="^[6-9]\d{9}$"
                              title="Please input a valid 10-digit mobile number starting with 6-9"
                              required
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
                          <span>Password</span>
                          {workerMode === 'login' && (
                            <button
                              type="button"
                              onClick={() => setWorkerMode('forgot-password')}
                              className="text-teal-600 hover:text-teal-800 text-xs font-semibold"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </label>
                        <div className="relative">
                          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/80 border border-teal-200 rounded-lg text-slate-900 placeholder-slate-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow"
                            placeholder={workerMode === 'signup' ? 'Min. 8 chars, 1 Uppercase, 1 Number, 1 Special' : '••••••••'}
                            required
                          />
                        </div>
                        {workerMode === 'signup' && (
                          <p className="text-slate-500 text-xs mt-1">Must contain an uppercase letter, number, and special character</p>
                        )}
                      </div>
                    </>
                  )}

                  {successMsg && (
                    <div className="text-teal-700 text-sm bg-teal-50 border border-teal-200 rounded-lg p-3">
                      {successMsg}
                    </div>
                  )}

                  {error && (
                    <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-md shadow-teal-200"
                  >
                    {loading
                      ? 'Processing...'
                      : workerMode === 'signup'
                      ? 'Sign Up'
                      : workerMode === 'forgot-password'
                      ? 'Send Reset Link'
                      : 'Sign In'}
                  </button>
                  
                  {workerMode === 'forgot-password' && (
                    <button
                      type="button"
                      onClick={() => setWorkerMode('login')}
                      className="w-full py-3 mt-2 text-teal-700 font-medium hover:bg-teal-50 rounded-xl border border-teal-100 transition-colors"
                    >
                      Back to Login
                    </button>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-teal-700/60 text-sm mt-6 font-medium">
          Powered by Aasara AI • Industrial Fintech Platform
        </p>
      </motion.div>
    </div>
  );
}
