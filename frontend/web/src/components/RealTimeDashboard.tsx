import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
  Bell,
  Wifi,
  CreditCard,
  CloudRain,
  X,
  ExternalLink,
  Zap,
  Camera,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GATEWAY_URL = 'http://localhost:5001';

export function RealTimeDashboard() {
  const { workerProfile } = useAuth();
  
  // State
  const [isOnline, setIsOnline] = useState(false);
  const [premium, setPremium] = useState(0);
  const [riskTier, setRiskTier] = useState('🟡 Moderate');
  const [activeDisruption, setActiveDisruption] = useState<any>(null);
  const [claimsHistory, setClaimsHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [heartbeatActive, setHeartbeatActive] = useState(false);
  const heartbeatRef = useRef<any>(null);
  const [lastPingAgo, setLastPingAgo] = useState('');
  
  // Fraud/Anomaly Verification State
  const [showMicroVerify, setShowMicroVerify] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [mockResult, setMockResult] = useState<'pass' | 'fail'>('pass');

  // Load data on mount
  useEffect(() => {
    loadSubscription();
    loadShiftStatus();
    checkActiveDisruption();
    fetchClaimsHistory();
    fetchNotifications();
    
    const interval = setInterval(() => {
      checkActiveDisruption();
      fetchClaimsHistory();
      fetchNotifications();
    }, 3000);
    return () => clearInterval(interval);
  }, [workerProfile]);

  // Heartbeat: POST every 3 minutes when online
  useEffect(() => {
    if (isOnline) {
      setHeartbeatActive(true);
      const sendHeartbeat = async () => {
        try {
          const token = localStorage.getItem('authToken');
          await fetch(`${GATEWAY_URL}/api/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
          setLastPingAgo('just now');
        } catch (e) { console.error('Heartbeat error', e); }
      };
      sendHeartbeat(); // immediate
      heartbeatRef.current = setInterval(sendHeartbeat, 3 * 60 * 1000); // every 3 min
      return () => {
        clearInterval(heartbeatRef.current);
        setHeartbeatActive(false);
      };
    } else {
      setHeartbeatActive(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    }
  }, [isOnline]);

  const getToken = () => localStorage.getItem('authToken');

  const loadSubscription = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/subscription/get-active`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.subscription) {
          setPremium(data.subscription.amount || 0);
          setRiskTier(data.subscription.riskTier || '🟡 Moderate');
        }
      }
    } catch (e) { console.error('Subscription load error', e); }
  };

  const loadShiftStatus = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/shifts/current-status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.isOnline || false);
      }
    } catch (e) { console.error('Shift status error', e); }
  };

  const checkActiveDisruption = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/disruption/check-active`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (res.ok && data.disruption) {
        setActiveDisruption(data.disruption);
      } else {
        setActiveDisruption(null);
      }
    } catch (e) { /* silent */ }
  };

  const fetchClaimsHistory = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/claims/my-claims`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setClaimsHistory(data.claims || []);
      }
    } catch (e) { /* silent */ }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) { /* silent */ }
  };

  // Camera Management
  const startCamera = async () => {
    try {
      setError('');
      setIsCameraActive(true);
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Camera access denied. Please enable permissions to continue.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      // Small delay simulation or just capture
      stopCamera();
      verifySyndicateAnomaly();
    }
  };

  // Liveness Challenge Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showMicroVerify && !verifyLoading && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (!showMicroVerify) {
      setTimeLeft(60); 
      stopCamera(); // Stop camera on close
    }
    return () => {
      clearInterval(timer);
    };
  }, [showMicroVerify, verifyLoading, timeLeft]);

  // Auto-start camera
  useEffect(() => {
    if (showMicroVerify && !verifyLoading) {
      startCamera();
    }
    return () => stopCamera();
  }, [showMicroVerify]);

  const verifySyndicateAnomaly = async () => {
    setVerifyLoading(true);
    // Simulate 3s vision processing
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`${GATEWAY_URL}/api/claims/verify-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mockResult })
      });
      const data = await res.json();
      if (res.ok) {
        setShowMicroVerify(false);
        checkActiveDisruption();
      } else {
        setError(data.error || 'Identity verification failed. Please try again.');
        setVerifyLoading(false);
      }
    } catch (e: any) { 
        console.error('Verification error', e); 
        setError('Machine Learning Engine rejected the proof. Please perform the gesture again.');
        setVerifyLoading(false);
    }
  };

  const toggleShift = async () => {
    const newStatus = !isOnline;
    try {
      const res = await fetch(`${GATEWAY_URL}/api/shifts/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ isOnline: newStatus }),
      });
      if (res.ok) {
        setIsOnline(newStatus);
      }
    } catch (e) { console.error('Toggle error', e); }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch(`${GATEWAY_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      });
      setUnreadCount(0);
    } catch (e) { /* silent */ }
  };

  // Get notification icon color
  const getNotifStyle = (type: string) => {
    switch (type) {
      case 'weather_warning': return { bg: 'bg-red-50', border: 'border-red-200', icon: '🔴', color: 'text-red-700' };
      case 'upi_receipt': return { bg: 'bg-green-50', border: 'border-green-200', icon: '💚', color: 'text-green-700' };
      case 'sms_sent': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: '📱', color: 'text-blue-700' };
      default: return { bg: 'bg-slate-50', border: 'border-slate-200', icon: '🔔', color: 'text-slate-700' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ====== HEADER with Notification Bell ====== */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gig Worker Dashboard</h1>
            <p className="text-slate-500 text-sm">AASARA Parametric Safety Net</p>
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }}
              className="relative p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-[60vh] overflow-y-auto"
                >
                  <div className="p-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
                    <h3 className="text-sm font-bold text-slate-800">🔔 Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-slate-500 text-sm">No notifications yet.</p>
                  ) : (
                    notifications.slice(0, 15).map((n, i) => {
                      const style = getNotifStyle(n.type);
                      return (
                        <div key={i} className={`p-3 border-b border-slate-100 last:border-0 ${style.bg} ${!n.read ? '' : 'opacity-60'}`}>
                          <p className={`text-sm font-bold ${style.color}`}>{n.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ====== SUBSCRIPTION STATUS BANNER ====== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-emerald-800 font-semibold text-sm">✅ Active Subscription</p>
              <p className="text-xs text-emerald-700/80">
                Premium paid: <strong className="text-emerald-700">₹{premium || 105}</strong> • Risk: <strong className="text-emerald-700">{riskTier}</strong>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-600">Coverage Active</p>
            <p className="text-emerald-700 text-sm font-bold">7 Days</p>
          </div>
        </motion.div>

        {/* ====== WEATHER WARNING + UPI RECEIPT (Real-time from Admin) ====== */}
        <AnimatePresence>
          {activeDisruption && (
            <div className="space-y-3">
              {/* 🔴 SEVERE WEATHER WARNING */}
              <motion.div
                initial={{ opacity: 0, x: -50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-5 relative overflow-hidden shadow-md"
              >
                {/* Animated flashing border */}
                <div className="absolute inset-0 border-2 border-red-400 rounded-xl animate-pulse opacity-40" />
                
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <CloudRain className="w-7 h-7 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-red-700 font-black text-lg tracking-wide">
                      🔴 {activeDisruption.eventLabel || 'SEVERE WEATHER WARNING'}
                    </p>
                    <p className="text-red-600 text-sm mt-1">
                      Severe <strong className="text-slate-900">{activeDisruption.eventType?.toUpperCase()}</strong> detected in your operational zone. Income disruption identified by AASARA AI Engine.
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-red-600">
                      <span>Severity: <strong className="text-slate-900">Level {activeDisruption.severity || 3}/5</strong></span>
                      <span>•</span>
                      <span>Triggered: {new Date(activeDisruption.triggeredAt).toLocaleTimeString()}</span>
                      {activeDisruption.flow === 'B' && (
                        <>
                          <span>•</span>
                          <span className="bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">📱 SMS Sent</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 🟢 UPI PAYOUT RECEIPT (if paid) */}
              {activeDisruption.status === 'paid' && (
                <motion.div
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.8 }}
                  className="bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-400 rounded-xl p-5 shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-7 h-7 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-green-700 font-black text-lg tracking-wide">💚 UPI PAYOUT RECEIPT</p>
                      <div className="bg-white border border-green-200 rounded-lg p-3 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-green-700 text-sm">Amount Credited</span>
                          <span className="text-green-700 text-3xl font-black">₹{activeDisruption.claimAmount || 700}</span>
                        </div>
                        <div className="border-t border-green-200 mt-2 pt-2 text-xs text-green-700/80 space-y-0.5">
                          <p>Method: <strong className="text-green-600">UPI Instant Transfer</strong></p>
                          <p>Transaction ID: <strong className="text-green-600">txn_{Date.now().toString().slice(-8)}</strong></p>
                          <p>Processed by: <strong className="text-green-600">AASARA Zero-Trust ML Engine</strong></p>
                          <p>Flow: <strong className="text-green-600">{activeDisruption.flow === 'B' ? 'Last Known State (Offline)' : 'Real-Time (Online)'}</strong></p>
                        </div>
                        {activeDisruption.txHash && (
                          <div className="mt-3">
                            <a 
                              href={`https://amoy.polygonscan.com/tx/${activeDisruption.txHash}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 border border-slate-700 text-teal-400 hover:text-teal-300 rounded-lg text-xs font-bold transition-all hover:bg-slate-800"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View Payout on PolygonScan
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Micro-verify (Standard) */}
              {(activeDisruption.status === 'micro_verify' && activeDisruption.flow !== 'syndicate_attack') && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <ShieldAlert className="w-8 h-8 text-amber-500 animate-pulse flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-amber-700 font-bold text-lg">📸 VERIFICATION REQUIRED</p>
                      <p className="text-slate-600 text-sm mt-1">Our ML engine detected an anomaly. Upload a timestamped photo to proceed with your ₹{activeDisruption.claimAmount} claim.</p>
                      <button className="mt-3 w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors">
                        Upload Photo Evidence
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 🔴 SYNDICATE ATTACK / FROZEN ANOMALY */}
              {activeDisruption.status === 'Frozen_Anomaly' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border-2 border-red-500 rounded-xl p-5 shadow-md relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                  <div className="flex items-start gap-4 relative z-10">
                    <ShieldAlert className="w-8 h-8 text-red-600 animate-bounce flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-red-700 font-extrabold text-lg">SECURITY ALERT: Network Anomaly Detected</p>
                      <p className="text-red-900 text-sm mt-1 font-bold">Auto-payout paused by Zero-Trust Engine.</p>
                      <p className="text-red-700/80 text-xs mt-2 font-medium">To protect your account and the community liquidity pool, please complete a micro-verification.</p>
                      <button 
                        onClick={() => setShowMicroVerify(true)}
                        className="mt-4 w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                      >
                        Start Micro-Verification
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* ====== MOCK GIG PLATFORM WIDGET + SHIFT STATUS ====== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Mock Gig Platform Widget (Zomato Style) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden shadow-sm"
          >
            {/* Faux platform branding */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white font-black text-xs">Z</span>
                </div>
                <div>
                  <p className="text-slate-900 font-bold text-sm">Mock Gig Platform</p>
                  <p className="text-slate-500 text-xs">{workerProfile?.platform || 'Zomato'} Delivery Partner</p>
                </div>
              </div>
              {isOnline && heartbeatActive && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-emerald-600 text-xs font-semibold">Heartbeat Active</span>
                </div>
              )}
            </div>

            {/* Big Toggle */}
            <div className="text-center py-4">
              <p className="text-5xl font-black text-slate-900 mb-3">
                {isOnline ? '🟢' : '🔴'}
              </p>
              <p className="text-slate-900 font-bold text-xl mb-1">
                {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-slate-500 text-xs mb-4">
                {isOnline 
                  ? 'Accepting orders • Heartbeat pinging every 3 min' 
                  : 'Toggle online to start accepting orders'}
              </p>
              <button
                onClick={toggleShift}
                className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all shadow-md ${
                  isOnline
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Power className="w-4 h-4" />
                  {isOnline ? 'Go Offline' : 'Start Shift'}
                </div>
              </button>
            </div>

            {/* Connection quality indicator */}
            {isOnline && (
              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-600">Connection</span>
                </div>
                <span className="text-emerald-700 font-bold">Strong • Last ping: {lastPingAgo || 'N/A'}</span>
              </div>
            )}
          </motion.div>

          {/* Subscription & Premium Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm font-semibold">SUBSCRIPTION DETAILS</span>
              <DollarSign className="w-5 h-5 text-teal-500" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Weekly Premium</span>
                <span className="text-emerald-600 text-2xl font-black">₹{premium || 105}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Risk Tier</span>
                <span className="text-slate-800 font-semibold">{riskTier}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Status</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 text-sm">Coverage</span>
                <span className="text-slate-800 font-semibold">24/7 All Disruptions</span>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Total Claims Received</span>
                  <span className="text-purple-600 font-bold">{claimsHistory.filter(c => c.status === 'paid').length}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-slate-600 text-sm">Total Payouts</span>
                  <span className="text-emerald-600 font-bold">
                    ₹{claimsHistory.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ====== CLAIMS PIPELINE TABLE ====== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              📄 My Claims Pipeline
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4 font-semibold">Event Type</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Flow</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claimsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No claims in your history yet. Your admin will trigger disruptions when detected.
                    </td>
                  </tr>
                ) : claimsHistory.map((claim) => (
                  <tr key={claim._id} className="hover:bg-slate-50 transition">
                    <td className="p-4">
                      <span className="font-medium text-slate-800 capitalize">
                        {claim.disruptionType || claim.eventType || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-emerald-600">₹{claim.amount}</td>
                    <td className="p-4 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        claim.payoutMethod === 'upi' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {claim.payoutMethod === 'upi' ? '⚡ Flow A' : '📱 Flow B (SMS)'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        claim.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        claim.status === 'micro_verify' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        claim.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {claim.status === 'paid' ? '💰 Paid' :
                         claim.status === 'micro_verify' ? '📸 Verify' :
                         claim.status === 'rejected' ? '🚫 Rejected' : 'Processing'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(claim.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>

      {/* Micro-Verification Modal Fallback */}
      <AnimatePresence>
        {showMicroVerify && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" /> Photo Verification
                </h3>
                <div className="flex items-center gap-2">
                    {/* Secret Hackathon Demo Toggle: Clicking the Zap icon flips the result */}
                    <button 
                        onClick={() => setMockResult(prev => prev === 'pass' ? 'fail' : 'pass')}
                        className={`p-1.5 rounded-md transition-all ${mockResult === 'fail' ? 'bg-red-100 text-red-600 rotate-12' : 'bg-slate-100 text-slate-400 opacity-50'}`}
                        title="Secret Demo Toggle: Simulate Failure"
                    >
                        <Zap className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowMicroVerify(false)} disabled={verifyLoading} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                </div>
              </div>

              {!verifyLoading ? (
                <div className="space-y-4">
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-semibold border border-red-200">
                    Your claim of ₹{activeDisruption?.claimAmount || 700} has been paused due to a network anomaly matching Syndicate spoofing patterns.
                  </div>
                  
                  {activeDisruption?.livenessChallenge && (
                    <div className="bg-slate-900 border-2 border-slate-700 text-white p-4 rounded-xl shadow-inner text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" /> Verify physical liveness <Zap className="w-3 h-3 text-amber-500" />
                      </p>
                      <p className="text-lg font-black text-teal-400">
                        {activeDisruption.livenessChallenge}
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <span className={`font-mono text-xl font-bold ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
                          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                        </span>
                      </div>
                    </div>
                  )}

                  {timeLeft === 0 ? (
                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-700 font-bold">Time Expired!</p>
                      <p className="text-red-600 text-xs mt-1">Please close and restart the verification process.</p>
                    </div>
                  ) : error ? (
                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-xl">
                      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                      <p className="text-red-700 font-bold text-sm">{error}</p>
                      <button onClick={startCamera} className="mt-2 text-xs font-bold text-red-600 underline">Try again</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-800 shadow-xl group">
                        {!isCameraActive ? (
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                             <Loader2 className="w-8 h-8 animate-spin" />
                             <p className="text-xs font-bold">Initializing Secure Feed...</p>
                           </div>
                        ) : (
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover scale-x-[-1]" 
                          />
                        )}
                        <div className="absolute top-3 right-3 flex gap-2">
                           <div className="bg-red-500/80 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                             <span className="text-[10px] font-black text-white uppercase tracking-tighter">Live Feed</span>
                           </div>
                        </div>
                      </div>

                      <p className="text-[11px] font-medium text-slate-500 text-center px-4 leading-tight">
                        AASARA Vision AI is monitoring the feed. Position yourself clearly and perform the requested finger gesture.
                      </p>

                      <button 
                        onClick={capturePhoto}
                        disabled={timeLeft === 0 || !isCameraActive}
                        className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-xl font-black text-sm shadow-lg shadow-teal-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
                      >
                        <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Capture Live Photo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 relative">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin" />
                    <Camera className="w-6 h-6 text-teal-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold text-slate-900">Vision AI Processing...</p>
                    <p className="text-xs text-slate-500 font-medium">Analyzing authenticity & <strong className="text-slate-700">'{activeDisruption?.livenessChallenge || 'gesture'}'</strong></p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
