import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
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

const GATEWAY_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export function RealTimeDashboard() {
  const { workerProfile, user } = useAuth();
  
  // State
  const [isOnline, setIsOnline] = useState(false);
  const [premium, setPremium] = useState(0);
  const [riskTier, setRiskTier] = useState('Moderate');
  const [platform, setPlatform] = useState('');
  const [lockoutError, setLockoutError] = useState('');
  const [showClaims, setShowClaims] = useState(false);
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

  // Socket.io real-time pipeline events
  const socketRef = useRef<Socket | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<any[]>([]);
  const [socketConnected, setSocketConnected] = useState(false);

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

  // Socket.io — real-time pipeline events
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const socket = io(GATEWAY_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket.io connected');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('pipeline:stage', (data: any) => {
      setPipelineEvents(prev => [{ ...data, id: Date.now() + Math.random() }, ...prev].slice(0, 20));
    });

    socket.on('pipeline:complete', (data: any) => {
      setPipelineEvents(prev => [{ ...data, stage: 'complete', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
      // Refresh data immediately when pipeline completes
      checkActiveDisruption();
      fetchClaimsHistory();
      fetchNotifications();
    });

    socket.on('payout:status', (data: any) => {
      setPipelineEvents(prev => [{ ...data, stage: 'webhook_confirmation', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
      fetchClaimsHistory();
      fetchNotifications();
    });

    socket.on('payment:confirmed', (data: any) => {
      setPipelineEvents(prev => [{ ...data, stage: 'payment_captured', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
      fetchNotifications();
    });

    socket.on('payment:failed', (data: any) => {
      setPipelineEvents(prev => [{ ...data, stage: 'payment_failed', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
      fetchNotifications();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Heartbeat: POST every 3 minutes when online — includes live GPS
  useEffect(() => {
    if (isOnline) {
      setHeartbeatActive(true);
      const sendHeartbeat = async () => {
        try {
          const token = localStorage.getItem('authToken');
          // Get current GPS position
          let lat: number | undefined, lng: number | undefined;
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
            );
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch {}
          await fetch(`${GATEWAY_URL}/api/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat, lng }),
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
          const tier = (data.subscription.riskTier || 'Moderate').replace(/^[🟢🟡🔴⚪]\s*/, '');
          setRiskTier(tier);
          setPlatform(data.subscription.platform || '');
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

  // Canvas ref for photo capture
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      // Capture current video frame onto a hidden canvas and extract base64
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width  = videoRef.current.videoWidth  || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }
      const photoData = canvas.toDataURL('image/jpeg', 0.8); // base64 JPEG
      stopCamera();
      verifySyndicateAnomaly(photoData);
    } else {
      stopCamera();
      verifySyndicateAnomaly(null);
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

  const verifySyndicateAnomaly = async (photoData?: string | null) => {
    setVerifyLoading(true);
    // Brief processing pause for UX
    await new Promise(r => setTimeout(r, 2500));
    try {
      const res = await fetch(`${GATEWAY_URL}/api/claims/verify-anomaly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mockResult, photoData: photoData || undefined })
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
    setLockoutError('');
    try {
      const res = await fetch(`${GATEWAY_URL}/api/shifts/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ isOnline: newStatus }),
      });
      if (res.ok) {
        setIsOnline(newStatus);
      } else {
        const data = await res.json();
        if (res.status === 403 && data.hoursRemaining) {
          setLockoutError(`Coverage activates in ${data.hoursRemaining}h. New policies have a 48-hour waiting period.`);
        } else {
          setLockoutError(data.error || 'Could not toggle shift.');
        }
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

  // Dismissed disruption cards
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [dismissedReceipt, setDismissedReceipt] = useState(false);

  // Reset dismissed state when disruption changes
  useEffect(() => {
    setDismissedWarning(false);
    setDismissedReceipt(false);
  }, [activeDisruption?._id]);

  // Get notification icon color
  const getNotifStyle = (type: string) => {
    switch (type) {
      case 'weather_warning': return { bg: 'bg-teal-50', border: 'border-teal-200', icon: '⚠️', color: 'text-teal-700' };
      case 'upi_receipt': return { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '💚', color: 'text-emerald-700' };
      case 'sms_sent': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: '📱', color: 'text-blue-700' };
      default: return { bg: 'bg-slate-50', border: 'border-slate-200', icon: '🔔', color: 'text-slate-700' };
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ====== HEADER with Notification Bell ====== */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.fullName || 'Worker'} !</h1>
            <p className="text-slate-500 text-sm">AASARA Parametric Safety Net</p>
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }}
              className="relative p-2 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-lg hover:bg-white transition shadow-sm"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#254B85] text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse shadow-sm">
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

        {/* ====== DETECTED TRIGGERS (Real-time from Admin) ====== */}
        <AnimatePresence>
          {activeDisruption && (
            <div className="space-y-3">
              {/* ⚠️ DISRUPTION DETECTED — Teal/Navy theme */}
              {!dismissedWarning && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="bg-gradient-to-br from-slate-50 via-cyan-50/60 to-teal-50 border border-teal-200/80 rounded-2xl p-5 relative overflow-hidden shadow-sm"
              >
                {/* Subtle left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#38C7D2] to-[#254B85] rounded-l-2xl" />
                
                <div className="flex items-start gap-4 relative z-10">
                  <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CloudRain className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#254B85]/10 text-[#254B85] rounded-md text-[10px] font-bold uppercase tracking-wider">
                        <Zap className="w-3 h-3" /> Detected Trigger
                      </span>
                    </div>
                    <p className="text-[#1A3668] font-bold text-base">
                      {activeDisruption.eventLabel || 'Weather Disruption Detected'}
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      <strong className="text-slate-700">{activeDisruption.eventType?.toUpperCase()}</strong> disruption detected in your zone. AASARA AI has initiated the payout pipeline.
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                        Severity: <strong className="text-[#254B85]">Level {activeDisruption.severity || 3}/5</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>{new Date(activeDisruption.triggeredAt).toLocaleTimeString()}</span>
                      {activeDisruption.flow === 'B' && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-semibold">📱 SMS Sent</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDismissedWarning(true)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
              )}

              {/* ✅ PAYOUT RECEIPT (if paid) */}
              {activeDisruption.status === 'paid' && !dismissedReceipt && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.3 }}
                  className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200/80 rounded-2xl p-5 shadow-sm relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-2xl" />

                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          ✓ Payout Completed
                        </span>
                      </div>
                      <p className="text-emerald-800 font-bold text-base">UPI Payout Receipt</p>
                      <div className="bg-white/80 border border-emerald-100 rounded-xl p-4 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-sm">Amount Credited</span>
                          <span className="text-emerald-700 text-3xl font-extrabold">₹{activeDisruption.claimAmount || 700}</span>
                        </div>
                        <div className="border-t border-emerald-100 mt-3 pt-3 text-xs text-slate-500 space-y-1">
                          <p>Method: <strong className="text-slate-700">UPI Instant Transfer</strong></p>
                          <p>Source: <strong className="text-slate-700">Community Liquidity Pool</strong></p>
                          <p>Transaction: <strong className="text-slate-700">txn_{Date.now().toString().slice(-8)}</strong></p>
                          <p>Engine: <strong className="text-slate-700">AASARA Payout Engine → Razorpay</strong></p>
                          <p>Flow: <strong className="text-slate-700">{activeDisruption.flow === 'B' ? 'Last Known State (Offline)' : 'Real-Time (Online)'}</strong></p>
                        </div>
                        {activeDisruption.txHash && (
                          <div className="mt-3">
                            <a 
                              href={`https://amoy.polygonscan.com/tx/${activeDisruption.txHash}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full py-2 bg-[#254B85] border border-[#1A3668] text-teal-300 hover:text-white rounded-lg text-xs font-bold transition-all hover:bg-[#1A3668]"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View on PolygonScan
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissedReceipt(true)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0"
                      title="Dismiss receipt"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Micro-verify (Standard) */}
              {(activeDisruption.status === 'micro_verify' && activeDisruption.flow !== 'syndicate_attack') && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-amber-50/60 via-white to-orange-50/30 border border-amber-200/80 rounded-2xl p-5 shadow-sm relative"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-400 rounded-l-2xl" />
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          Verification Needed
                        </span>
                      </div>
                      <p className="text-amber-800 font-bold text-base">Identity Verification Required</p>
                      <p className="text-slate-500 text-sm mt-1">Our ML engine flagged an anomaly. Upload a timestamped photo to proceed with your ₹{activeDisruption.claimAmount} claim.</p>
                      <button className="mt-3 w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-bold text-sm shadow-sm transition-colors">
                        Upload Photo Evidence
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 🔒 FROZEN ANOMALY / SYNDICATE */}
              {activeDisruption.status === 'Frozen_Anomaly' && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-slate-50 via-white to-[#254B85]/5 border border-[#254B85]/20 rounded-2xl p-5 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#254B85] to-[#38C7D2] rounded-l-2xl" />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className="w-11 h-11 bg-[#254B85]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-6 h-6 text-[#254B85]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#254B85]/10 text-[#254B85] rounded-md text-[10px] font-bold uppercase tracking-wider">
                          🔒 Security Review
                        </span>
                      </div>
                      <p className="text-[#1A3668] font-bold text-base">Network Anomaly Detected</p>
                      <p className="text-slate-500 text-sm mt-1">Auto-payout paused by Zero-Trust Engine. Complete a quick verification to release your funds.</p>
                      <button 
                        onClick={() => setShowMicroVerify(true)}
                        className="mt-3 w-full py-2.5 bg-gradient-to-r from-[#254B85] to-[#1A3668] hover:from-[#1A3668] hover:to-[#0f2440] text-white rounded-xl font-bold text-sm shadow-sm transition-colors"
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

        {/* ====== PLATFORM & SHIFT STATUS ====== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Platform Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl p-5 relative overflow-hidden shadow-sm"
          >
            {/* Platform branding */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
                  platform?.toLowerCase() === 'swiggy' ? 'bg-orange-500' :
                  platform?.toLowerCase() === 'zomato' ? 'bg-red-500' :
                  platform?.toLowerCase() === 'uber' ? 'bg-black' :
                  platform?.toLowerCase() === 'ola' ? 'bg-green-600' :
                  platform?.toLowerCase() === 'rapido' ? 'bg-yellow-500' :
                  platform?.toLowerCase() === 'zepto' ? 'bg-purple-600' :
                  platform?.toLowerCase() === 'blinkit' ? 'bg-yellow-400' :
                  platform?.toLowerCase() === 'dunzo' ? 'bg-green-500' :
                  'bg-teal-600'
                }`}>
                  <span className="text-white font-black text-xs">{(platform || 'G')[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-slate-900 font-bold text-sm">{platform || 'Gig Platform'}</p>
                  <p className="text-slate-500 text-xs">Delivery Partner</p>
                </div>
              </div>
              {isOnline && heartbeatActive && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-emerald-600 text-xs font-semibold">Heartbeat Active</span>
                </div>
              )}
            </div>

            {/* Shift Toggle */}
            <div className="text-center py-4">
              <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${
                isOnline ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-100 border-2 border-slate-200'
              }`}>
                <Power className={`w-7 h-7 ${isOnline ? 'text-emerald-500' : 'text-slate-400'}`} />
              </div>
              <p className="text-slate-900 font-bold text-xl mb-1">
                {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-slate-500 text-xs mb-4">
                {isOnline 
                  ? 'Accepting orders • Heartbeat pinging every 3 min' 
                  : 'Toggle online to start your shift'}
              </p>
              {lockoutError && (
                <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{lockoutError}</span>
                </div>
              )}
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
            className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl p-5 shadow-sm"
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
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  riskTier.toLowerCase().includes('low') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  riskTier.toLowerCase().includes('high') ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <ShieldAlert className="w-3 h-3" />
                  {riskTier}
                </span>
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

        {/* ====== REAL-TIME PIPELINE FEED ====== */}
        {pipelineEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-sm border border-teal-200/60 rounded-xl overflow-hidden shadow-sm"
          >
            <div className="p-4 border-b border-teal-200 bg-teal-50">
              <h3 className="font-bold text-teal-800 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
                </span>
                Live Pipeline Feed
                {socketConnected && <span className="text-xs font-normal text-teal-600 ml-2">● Connected</span>}
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {pipelineEvents.map((evt) => {
                const stageConfig: Record<string, { icon: string; color: string; label: string }> = {
                  trigger_detected: { icon: '🌩️', color: 'text-amber-700 bg-amber-50', label: 'Trigger Detected' },
                  fraud_check: { icon: '🛡️', color: 'text-blue-700 bg-blue-50', label: 'Fraud Check' },
                  payout_initiated: { icon: '💸', color: 'text-emerald-700 bg-emerald-50', label: 'Payout Initiated' },
                  blockchain_logged: { icon: '⛓️', color: 'text-purple-700 bg-purple-50', label: 'Blockchain Logged' },
                  webhook_confirmation: { icon: '✅', color: 'text-teal-700 bg-teal-50', label: 'Bank Confirmed' },
                  payment_captured: { icon: '💰', color: 'text-green-700 bg-green-50', label: 'Premium Verified' },
                  payment_failed: { icon: '❌', color: 'text-red-700 bg-red-50', label: 'Payment Failed' },
                  complete: { icon: '🎉', color: 'text-emerald-700 bg-emerald-50', label: 'Pipeline Complete' },
                };
                const cfg = stageConfig[evt.stage] || { icon: '📡', color: 'text-slate-700 bg-slate-50', label: evt.stage };
                return (
                  <div key={evt.id} className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-slate-50 transition">
                    <span className="text-lg">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                      <p className="text-slate-600 text-xs mt-0.5 truncate">
                        {evt.workerName && <span className="font-medium">{evt.workerName}</span>}
                        {evt.amount && <span> • ₹{evt.amount}</span>}
                        {evt.fraudVerdict && <span> • Verdict: <strong>{evt.fraudVerdict}</strong></span>}
                        {evt.fraudScore !== undefined && evt.stage === 'fraud_check' && <span> • Score: {evt.fraudScore}</span>}
                        {evt.payoutMethod && evt.stage === 'payout_initiated' && <span> • via {evt.payoutMethod}</span>}
                        {evt.method && evt.stage === 'payment_captured' && <span> • via {evt.method}{evt.vpa ? ` (${evt.vpa})` : ''}</span>}
                        {evt.errorDesc && evt.stage === 'payment_failed' && <span> • {evt.errorDesc}</span>}
                        {evt.txHash && <span> • tx: {evt.txHash.slice(0, 10)}…</span>}
                        {evt.utr && <span> • UTR: {evt.utr}</span>}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ====== CLAIMS PIPELINE TABLE ====== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl overflow-hidden shadow-sm"
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              📄 My Claims Pipeline
            </h3>
            <button
              onClick={() => setShowClaims(prev => !prev)}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors px-2 py-1 rounded-md hover:bg-slate-100"
            >
              {showClaims ? 'Hide Claims' : `Show Claims${claimsHistory.length > 0 ? ` (${claimsHistory.length})` : ''}`}
            </button>
          </div>
          {showClaims && (
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
          )}
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
                  <ShieldAlert className="w-5 h-5 text-[#254B85]" /> Photo Verification
                </h3>
                <div className="flex items-center gap-2">
                    {/* Secret Hackathon Demo Toggle: Clicking the Zap icon flips the result */}
                    <button 
                        onClick={() => setMockResult(prev => prev === 'pass' ? 'fail' : 'pass')}
                        className={`p-1.5 rounded-md transition-all ${mockResult === 'fail' ? 'bg-amber-100 text-amber-600 rotate-12' : 'bg-slate-100 text-slate-400 opacity-50'}`}
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
                  <div className="bg-[#254B85]/5 text-[#254B85] p-3 rounded-xl text-xs font-semibold border border-[#254B85]/15">
                    Your claim of ₹{activeDisruption?.claimAmount || 700} has been paused due to a network anomaly. Complete verification to release funds.
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
                        <span className={`font-mono text-xl font-bold ${timeLeft < 10 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                          00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                        </span>
                      </div>
                    </div>
                  )}

                  {timeLeft === 0 ? (
                    <div className="text-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-[#254B85] font-bold">Time Expired</p>
                      <p className="text-slate-500 text-xs mt-1">Please close and restart the verification process.</p>
                    </div>
                  ) : error ? (
                    <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-amber-700 font-bold text-sm">{error}</p>
                      <button onClick={startCamera} className="mt-2 text-xs font-bold text-teal-600 underline">Try again</button>
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
                        {/* Hidden canvas used to capture a still frame for EfficientNetB0 analysis */}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <div className="absolute top-3 right-3 flex gap-2">
                           <div className="bg-teal-600/80 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1.5">
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
