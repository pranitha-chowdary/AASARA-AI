import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  Platform,
  StatusBar,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { apiService, getSocketBaseUrl } from '../services/api';
import { liveTrackingService, TrackingState } from '../services/liveTrackingService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Subscription {
  premium: number;
  riskTier: string;
  planType: string;
  startDate?: string;
  endDate?: string;
  amount?: number;
  activeDays?: number;
  eligibilityMet?: boolean;
}

interface Disruption {
  _id: string;
  disruptionType?: string;
  eventType?: string;
  eventLabel?: string;
  severity?: number;
  status: string;
  timestamp?: string;
  triggeredAt?: string;
  payoutAmount?: number;
  claimAmount?: number;
  upiTransactionId?: string;
  txHash?: string;
  anomalyChallenge?: string;
  livenessChallenge?: string;
  flow?: string;
}

interface Claim {
  _id: string;
  eventType?: string;
  disruptionType?: string;
  amount: number;
  flowType?: string;
  payoutMethod?: string;
  status: string;
  createdAt: string;
}

interface NotificationItem {
  _id: string;
  title?: string;
  message: string;
  type: string;
  read?: boolean;
  isRead?: boolean;
  createdAt: string;
}

const WorkerDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [disruption, setDisruption] = useState<Disruption | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastPingAgo, setLastPingAgo] = useState<string | null>(null);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [heartbeatActive, setHeartbeatActive] = useState(false);

  const [shiftLoading, setShiftLoading] = useState(false);
  const [loadingMain, setLoadingMain] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showMicroModal, setShowMicroModal] = useState(false);

  // Dismissed disruption cards
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [dismissedReceipt, setDismissedReceipt] = useState(false);

  // Micro-verification
  const [mockResult, setMockResult] = useState<'pass' | 'fail'>('pass');
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);
  const [verifyError, setVerifyError] = useState('');

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<any[]>([]);

  // Live GPS tracking state
  const [trackingState, setTrackingState] = useState<TrackingState>(liveTrackingService.getState());

  useEffect(() => {
    initDashboard();
    const unsub = liveTrackingService.subscribe(setTrackingState);
    return () => { cleanup(); unsub(); };
  }, []);

  // Socket.io — real-time pipeline events
  useEffect(() => {
    let socket: Socket | null = null;
    (async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      socket = io(getSocketBaseUrl(), {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
      });

      socket.on('pipeline:stage', (data: any) => {
        setPipelineEvents(prev => [{ ...data, id: Date.now() + Math.random() }, ...prev].slice(0, 20));
      });

      socket.on('pipeline:complete', (data: any) => {
        setPipelineEvents(prev => [{ ...data, stage: 'complete', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
        fetchAll();
      });

      socket.on('payout:status', (data: any) => {
        setPipelineEvents(prev => [{ ...data, stage: 'webhook_confirmation', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
        fetchAll();
      });

      socket.on('payment:confirmed', (data: any) => {
        setPipelineEvents(prev => [{ ...data, stage: 'payment_captured', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
        fetchAll();
      });

      socket.on('payment:failed', (data: any) => {
        setPipelineEvents(prev => [{ ...data, stage: 'payment_failed', id: Date.now() + Math.random() }, ...prev].slice(0, 20));
        fetchAll();
      });

      socketRef.current = socket;
    })();

    return () => {
      if (socket) socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Reset dismissed state when disruption changes
  useEffect(() => {
    setDismissedWarning(false);
    setDismissedReceipt(false);
  }, [disruption?._id]);

  // Micro-verify timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (showMicroModal && !verifying && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    }
    if (!showMicroModal) { setTimeLeft(60); setVerifyError(''); }
    return () => clearInterval(timer);
  }, [showMicroModal, verifying, timeLeft]);

  const cleanup = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const initDashboard = async () => {
    setLoadingMain(true);
    await Promise.all([fetchShiftStatus(), fetchSubscription(), fetchAll()]);
    setLoadingMain(false);
    startPolling();
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchAll, 3000);
  };

  const fetchAll = async () => {
    await Promise.allSettled([fetchDisruption(), fetchClaims(), fetchNotifications()]);
  };

  const fetchShiftStatus = async () => {
    try { const data = await apiService.getShiftStatus(); setIsOnline(data?.isOnline ?? false); } catch {}
  };

  const fetchSubscription = async () => {
    try { const sub = await apiService.getActiveSubscription(); if (sub) setSubscription(sub); } catch {}
  };

  const fetchDisruption = async () => {
    try { const data = await apiService.checkActiveDisruption(); setDisruption(data || null); } catch {}
  };

  const fetchClaims = async () => {
    try { const data = await apiService.fetchClaimsHistory(); setClaims(Array.isArray(data) ? data.slice(0, 10) : []); } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiService.fetchNotifications();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch {}
  };

  // Heartbeat
  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setHeartbeatActive(true);
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 3 * 60 * 1000);
  };
  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    setHeartbeatActive(false);
  };
  const sendHeartbeat = async () => {
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } catch {}
      await apiService.sendHeartbeat(lat, lng);
      setLastPingTime(new Date());
      setLastPingAgo('just now');
    } catch {}
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastPingTime) return;
      const secs = Math.floor((Date.now() - lastPingTime.getTime()) / 1000);
      if (secs < 60) setLastPingAgo('just now');
      else if (secs < 120) setLastPingAgo('1 min ago');
      else setLastPingAgo(Math.floor(secs / 60) + ' min ago');
    }, 30000);
    return () => clearInterval(timer);
  }, [lastPingTime]);

  const handleShiftToggle = async () => {
    const newState = !isOnline;
    setShiftLoading(true);
    try {
      await apiService.toggleShiftStatus(newState);
      setIsOnline(newState);
      if (newState) {
        startHeartbeat();
        // Start live GPS tracking
        const workerId = (user as any)?._id || (user as any)?.userId || 'unknown';
        const result = await liveTrackingService.start(workerId);
        if (!result.success) {
          console.warn('[Shift] GPS tracking failed:', result.error);
        }
      } else {
        stopHeartbeat();
        liveTrackingService.stop();
        setLastPingAgo(null);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update shift status.');
    } finally { setShiftLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { cleanup(); await logout(); } },
    ]);
  };

  const handleOpenNotifications = async () => {
    setShowNotifModal(true);
    if (unreadCount > 0) {
      try { await apiService.markNotificationsRead(); setUnreadCount(0); } catch {}
    }
  };

  // Camera & Verification
  const openMicroVerify = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera permission is needed for identity verification.');
        return;
      }
    }
    setShowMicroModal(true);
    setCameraReady(false);
    setVerifyError('');
    setTimeLeft(60);
  };

  const captureAndVerify = async () => {
    setVerifying(true);
    setVerifyError('');
    // Brief UX pause
    await new Promise(r => setTimeout(r, 2500));
    try {
      await apiService.verifyAnomaly(mockResult);
      setShowMicroModal(false);
      await fetchDisruption();
    } catch (err: any) {
      setVerifyError(err?.response?.data?.error || 'Verification failed. Please try again.');
      setVerifying(false);
    } finally {
      setVerifying(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAll(), fetchSubscription(), fetchShiftStatus()]);
    setRefreshing(false);
  }, []);

  const getNotifStyle = (type: string) => {
    switch (type) {
      case 'weather_warning': return { bg: '#ecfdf5', border: '#6ee7b7', icon: '⚠️', color: '#0d9488' };
      case 'upi_receipt': return { bg: '#f0fdf4', border: '#86efac', icon: '💚', color: '#16a34a' };
      case 'sms_sent': return { bg: '#eff6ff', border: '#93c5fd', icon: '📱', color: '#2563eb' };
      default: return { bg: '#f8fafc', border: '#e2e8f0', icon: '🔔', color: '#475569' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return { bg: '#dcfce7', color: '#15803d', border: '#86efac', label: '💰 Paid' };
      case 'micro_verify': return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: '📸 Verify' };
      case 'rejected': return { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: '🚫 Rejected' };
      case 'Frozen_Anomaly': return { bg: '#f0f4ff', color: '#254B85', border: '#93c5fd', label: '🔒 Frozen' };
      default: return { bg: '#eff6ff', color: '#2563eb', border: '#93c5fd', label: '⏳ Processing' };
    }
  };

  if (loadingMain) {
    return (
      <SafeAreaView style={S.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={{ marginTop: 12, fontSize: 14, color: '#134e4a' }}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const premium = subscription?.premium || subscription?.amount || 0;
  const riskTier = subscription?.riskTier || '🟡 Moderate';

  return (
    <SafeAreaView style={S.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#f0fdfa" />
      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
        showsVerticalScrollIndicator={false}
      >

        {/* ========== HEADER ========== */}
        <View style={S.header}>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle}>Welcome, {user?.fullName || 'Worker'} !</Text>
            <Text style={S.headerSubtitle}>AASARA Parametric Safety Net</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity style={S.bellBtn} onPress={handleOpenNotifications}>
              <Ionicons name="notifications-outline" size={22} color="#64748b" />
              {unreadCount > 0 && (
                <View style={S.bellBadge}>
                  <Text style={S.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={S.logoutChip} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={16} color="#0d9488" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ========== SUBSCRIPTION STATUS BANNER ========== */}
        {subscription && (
          <View style={S.subBanner}>
            <View style={S.subBannerIcon}>
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.subBannerTitle}>✅ Active Subscription</Text>
              <Text style={S.subBannerDesc}>
                Premium: <Text style={{ fontWeight: '800', color: '#059669' }}>₹{premium}</Text> • Risk: <Text style={{ fontWeight: '700' }}>{riskTier}</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#059669' }}>Coverage</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#059669' }}>7 Days</Text>
            </View>
          </View>
        )}

        {/* ========== 90-DAY ELIGIBILITY STATUS (Social Security Code, 2020 §6) ========== */}
        {subscription?.activeDays != null && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: subscription.eligibilityMet ? '#ecfdf5' : '#fffbeb',
            borderWidth: 1, borderColor: subscription.eligibilityMet ? '#a7f3d0' : '#fde68a',
            borderRadius: 14, padding: 14, gap: 12,
          }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: subscription.eligibilityMet ? '#d1fae5' : '#fef3c7',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 20 }}>{subscription.eligibilityMet ? '🛡️' : '⏳'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 13, fontWeight: '700',
                color: subscription.eligibilityMet ? '#065f46' : '#92400e',
              }}>
                {subscription.eligibilityMet ? '✅ Payout Eligible' : '⏳ Eligibility Pending'}
              </Text>
              <Text style={{
                fontSize: 11, marginTop: 2,
                color: subscription.eligibilityMet ? '#047857' : '#b45309',
              }}>
                SS Code 2020 §6 — {subscription.activeDays}/90 active days
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', width: 80 }}>
              <View style={{
                width: '100%', height: 8, backgroundColor: '#e2e8f0',
                borderRadius: 4, overflow: 'hidden',
              }}>
                <View style={{
                  width: `${Math.min((subscription.activeDays / 90) * 100, 100)}%`,
                  height: 8, borderRadius: 4,
                  backgroundColor: subscription.eligibilityMet ? '#10b981' : '#f59e0b',
                }} />
              </View>
              <Text style={{
                fontSize: 10, fontWeight: '800', marginTop: 3,
                color: subscription.eligibilityMet ? '#059669' : '#b45309',
              }}>
                {subscription.eligibilityMet ? 'Fully Eligible' : `${90 - subscription.activeDays}d left`}
              </Text>
            </View>
          </View>
        )}

        {/* ========== DETECTED TRIGGERS (Active Disruption) ========== */}
        {disruption && (disruption.status === 'pending' || disruption.status === 'paid' || disruption.status === 'micro_verify' || disruption.status === 'Frozen_Anomaly') && (
          <View style={{ gap: 12 }}>
            {/* ⚠️ DISRUPTION DETECTED — Teal/Navy theme */}
            {!dismissedWarning && (
            <View style={S.triggerCard}>
              <View style={S.triggerAccent} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                <View style={S.triggerIconCircle}>
                  <Ionicons name="thunderstorm" size={22} color="#0d9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={S.triggerBadge}>
                    <Ionicons name="flash" size={10} color="#254B85" />
                    <Text style={S.triggerBadgeText}>Detected Trigger</Text>
                  </View>
                  <Text style={S.triggerTitle}>{disruption.eventLabel || 'Weather Disruption Detected'}</Text>
                  <Text style={S.triggerDesc}>
                    <Text style={{ fontWeight: '700', color: '#334155' }}>{(disruption.eventType || disruption.disruptionType || 'WEATHER')?.toUpperCase()}</Text> disruption detected in your zone. AASARA AI has initiated the payout pipeline.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#38C7D2' }} />
                      <Text style={S.triggerMeta}>Severity: <Text style={{ fontWeight: '800', color: '#254B85' }}>Level {disruption.severity || 3}/5</Text></Text>
                    </View>
                    <Text style={{ color: '#cbd5e1', fontSize: 11 }}>|</Text>
                    <Text style={S.triggerMeta}>{new Date(disruption.triggeredAt || disruption.timestamp || '').toLocaleTimeString()}</Text>
                    {disruption.flow === 'B' && (
                      <>
                        <Text style={{ color: '#cbd5e1', fontSize: 11 }}>|</Text>
                        <View style={S.smsBadgeNew}><Text style={S.smsBadgeNewText}>📱 SMS Sent</Text></View>
                      </>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setDismissedWarning(true)} style={S.dismissBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
            )}

            {/* ✅ PAYOUT RECEIPT */}
            {disruption.status === 'paid' && !dismissedReceipt && (
              <View style={S.receiptCard}>
                <View style={S.receiptAccent} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                  <View style={S.receiptIconCircle}>
                    <Ionicons name="card" size={22} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={S.receiptBadge}>
                      <Text style={S.receiptBadgeText}>✓ Payout Completed</Text>
                    </View>
                    <Text style={S.receiptTitle}>UPI Payout Receipt</Text>
                    <View style={S.receiptBody}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>Amount Credited</Text>
                        <Text style={S.receiptAmount}>₹{disruption.claimAmount || disruption.payoutAmount || 700}</Text>
                      </View>
                      <View style={S.receiptDivider} />
                      <View style={{ gap: 4 }}>
                        <Text style={S.receiptDetail}>Method: <Text style={{ fontWeight: '700', color: '#334155' }}>UPI Instant Transfer</Text></Text>
                        <Text style={S.receiptDetail}>Source: <Text style={{ fontWeight: '700', color: '#334155' }}>Community Liquidity Pool</Text></Text>
                        <Text style={S.receiptDetail}>Transaction: <Text style={{ fontWeight: '700', color: '#334155' }}>txn_{Date.now().toString().slice(-8)}</Text></Text>
                        <Text style={S.receiptDetail}>Engine: <Text style={{ fontWeight: '700', color: '#334155' }}>AASARA Payout Engine</Text></Text>
                        <Text style={S.receiptDetail}>Flow: <Text style={{ fontWeight: '700', color: '#334155' }}>{disruption.flow === 'B' ? 'Last Known (Offline)' : 'Real-Time (Online)'}</Text></Text>
                      </View>
                      {disruption.txHash && (
                        <TouchableOpacity
                          style={S.polygonBtnNew}
                          onPress={() => Linking.openURL(`https://amoy.polygonscan.com/tx/${disruption.txHash}`)}
                        >
                          <Feather name="external-link" size={14} color="#5eead4" />
                          <Text style={S.polygonBtnNewText}>View on PolygonScan</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setDismissedReceipt(true)} style={S.dismissBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 📸 VERIFICATION REQUIRED (Standard) */}
            {disruption.status === 'micro_verify' && disruption.flow !== 'syndicate_attack' && (
              <View style={S.verifyCardNew}>
                <View style={S.verifyAccent} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                  <View style={S.verifyIconCircle}>
                    <Ionicons name="shield-checkmark" size={22} color="#d97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={S.verifyBadge}>
                      <Text style={S.verifyBadgeText}>Verification Needed</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400e' }}>Identity Verification Required</Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      Our ML engine flagged an anomaly. Upload a photo to proceed with your ₹{disruption.claimAmount || 700} claim.
                    </Text>
                    <TouchableOpacity style={S.verifyBtn} onPress={openMicroVerify}>
                      <Ionicons name="camera" size={18} color="#fff" />
                      <Text style={S.actionBtnText}>Upload Photo Evidence</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* 🔒 SECURITY REVIEW / FROZEN ANOMALY */}
            {disruption.status === 'Frozen_Anomaly' && (
              <View style={S.frozenCardNew}>
                <View style={S.frozenAccent} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 4 }}>
                  <View style={S.frozenIconCircle}>
                    <Ionicons name="shield" size={22} color="#254B85" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={S.frozenBadge}>
                      <Text style={S.frozenBadgeText}>🔒 Security Review</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A3668' }}>Network Anomaly Detected</Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                      Auto-payout paused by Zero-Trust Engine. Complete a quick verification to release your funds.
                    </Text>
                    <TouchableOpacity style={S.frozenBtn} onPress={openMicroVerify}>
                      <Ionicons name="lock-closed" size={16} color="#fff" />
                      <Text style={S.actionBtnText}>Start Micro-Verification</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========== GIG PLATFORM + SHIFT TOGGLE ========== */}
        <View style={S.gridRow}>
          {/* Mock Gig Platform Widget */}
          <View style={[S.gridCard, { flex: 1 }]}>
            <View style={S.platformHeader}>
              <View style={S.platformBrand}>
                <View style={S.platformLogo}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>Z</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>Mock Gig Platform</Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{(user as any)?.platform || 'Zomato'} Partner</Text>
                </View>
              </View>
              {isOnline && heartbeatActive && (
                <View style={S.heartbeatBadge}>
                  <View style={S.heartbeatDot} />
                  <Text style={S.heartbeatText}>Live</Text>
                </View>
              )}
            </View>

            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 48 }}>{isOnline ? '🟢' : '🔴'}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 8 }}>{isOnline ? 'Online' : 'Offline'}</Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' }}>
                {isOnline ? 'Accepting orders • Live GPS tracking active' : 'Toggle online to start accepting orders'}
              </Text>
              {/* ====== LIVE GPS TRACKING WIDGET ====== */}
              {isOnline && trackingState.isTracking && trackingState.currentLocation && (
                <View style={S.gpsWidget}>
                  {/* Green header bar */}
                  <View style={S.gpsWidgetHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ position: 'relative' }}>
                        <Ionicons name="radio-outline" size={14} color="#fff" />
                        <View style={S.gpsPingDot} />
                      </View>
                      <Text style={S.gpsWidgetTitle}>LIVE GPS TRACKING</Text>
                    </View>
                    <View style={S.gpsSourceBadge}>
                      <Text style={S.gpsSourceText}>🛰️ REAL GPS</Text>
                    </View>
                  </View>
                  {/* Body with radar + coordinates */}
                  <View style={S.gpsWidgetBody}>
                    {/* Radar animation circle */}
                    <View style={S.gpsRadarOuter}>
                      <View style={S.gpsRadarMiddle}>
                        <View style={S.gpsRadarCenter}>
                          <Ionicons name="navigate" size={14} color="#fff" />
                        </View>
                      </View>
                    </View>
                    {/* Coordinates + metadata */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="location" size={14} color="#059669" />
                        <Text style={S.gpsCoordText}>
                          {trackingState.currentLocation.lat.toFixed(4)}°, {trackingState.currentLocation.lng.toFixed(4)}°
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <View style={[S.gpsDotSmall, { backgroundColor: trackingState.anomalyScore > 30 ? '#ef4444' : '#059669' }]} />
                          <Text style={S.gpsMetaText}>
                            Anomaly: <Text style={{ fontWeight: '700', color: trackingState.anomalyScore > 30 ? '#dc2626' : '#059669' }}>{trackingState.anomalyScore}</Text>
                          </Text>
                        </View>
                        <Text style={S.gpsMetaDivider}>|</Text>
                        <Text style={S.gpsMetaText}>{trackingState.pathHistory?.length || 0} pts</Text>
                        {trackingState.lastSyncTime && (
                          <>
                            <Text style={S.gpsMetaDivider}>|</Text>
                            <Text style={S.gpsMetaText}>{new Date(trackingState.lastSyncTime).toLocaleTimeString()}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[S.shiftBtn, isOnline ? S.shiftBtnOff : S.shiftBtnOn]}
              onPress={handleShiftToggle}
              disabled={shiftLoading}
              activeOpacity={0.85}
            >
              {shiftLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="power" size={18} color="#fff" />
                  <Text style={S.shiftBtnText}>{isOnline ? 'Go Offline' : 'Start Shift'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Connection quality */}
            {isOnline && (
              <View style={S.connectionBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="wifi" size={14} color="#059669" />
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Connection</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>Strong • {lastPingAgo || 'N/A'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ========== SUBSCRIPTION & PREMIUM CARD ========== */}
        <View style={S.detailCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 }}>SUBSCRIPTION DETAILS</Text>
            <Ionicons name="cash-outline" size={18} color="#0d9488" />
          </View>
          <View style={{ gap: 12 }}>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Weekly Premium</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#059669' }}>₹{premium || 105}</Text>
            </View>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Risk Tier</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>{riskTier}</Text>
            </View>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>Active</Text>
              </View>
            </View>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Coverage</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>24/7 All Disruptions</Text>
            </View>
            <View style={S.detailDivider} />
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Total Claims Received</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#7c3aed' }}>{claims.filter(c => c.status === 'paid').length}</Text>
            </View>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Total Payouts</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#059669' }}>
                ₹{claims.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* ========== NO DISRUPTION ========== */}
        {!disruption && (
          <View style={[S.detailCard, { borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 24 }}>✅</Text>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#059669' }}>No Active Disruptions</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Your route is clear. Stay safe!</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========== LIVE PIPELINE FEED ========== */}
        {pipelineEvents.length > 0 && (
          <>
            <View style={S.sectionHeader}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#14b8a6', marginRight: 4 }} />
              <Text style={S.sectionTitle}>Live Pipeline Feed</Text>
            </View>
            <View style={[S.detailCard, { maxHeight: 200, overflow: 'hidden' }]}>
              {pipelineEvents.slice(0, 8).map((evt: any) => {
                const icons: Record<string, string> = {
                  trigger_detected: '🌩️',
                  fraud_check: '🛡️',
                  payout_initiated: '💸',
                  blockchain_logged: '⛓️',
                  webhook_confirmation: '✅',
                  payment_captured: '💰',
                  payment_failed: '❌',
                  complete: '🎉',
                };
                const labels: Record<string, string> = {
                  trigger_detected: 'Trigger',
                  fraud_check: 'Fraud Check',
                  payout_initiated: 'Payout',
                  blockchain_logged: 'Blockchain',
                  webhook_confirmation: 'Bank Confirmed',
                  payment_captured: 'Premium Verified',
                  payment_failed: 'Payment Failed',
                  complete: 'Complete',
                };
                return (
                  <View key={evt.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                    <Text style={{ fontSize: 16, marginRight: 8 }}>{icons[evt.stage] || '📡'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0d9488' }}>{labels[evt.stage] || evt.stage}</Text>
                      <Text style={{ fontSize: 10, color: '#64748b' }} numberOfLines={1}>
                        {evt.workerName}{evt.amount ? ` • ₹${evt.amount}` : ''}{evt.fraudVerdict ? ` • ${evt.fraudVerdict}` : ''}{evt.txHash ? ` • tx:${evt.txHash.slice(0, 10)}…` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 9, color: '#94a3b8' }}>{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ========== CLAIMS PIPELINE ========== */}
        <View style={S.sectionHeader}>
          <Ionicons name="document-text-outline" size={18} color="#134e4a" />
          <Text style={S.sectionTitle}>My Claims Pipeline</Text>
        </View>

        {claims.length === 0 ? (
          <View style={[S.detailCard, { alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ fontSize: 32 }}>📪</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>No claims in your history yet.</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Your admin will trigger disruptions when detected.</Text>
          </View>
        ) : (
          claims.map((claim) => {
            const badge = getStatusBadge(claim.status);
            return (
              <View key={claim._id} style={S.claimRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' }}>
                    {claim.disruptionType || claim.eventType || 'Unknown'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {new Date(claim.createdAt).toLocaleDateString()} • {new Date(claim.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#059669' }}>₹{claim.amount}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <View style={[S.chipBadge, { backgroundColor: (claim.payoutMethod === 'upi' || claim.flowType === 'A') ? '#dbeafe' : '#fce7f3' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: (claim.payoutMethod === 'upi' || claim.flowType === 'A') ? '#1d4ed8' : '#9d174d' }}>
                        {(claim.payoutMethod === 'upi' || claim.flowType === 'A') ? '⚡ Flow A' : '📱 Flow B'}
                      </Text>
                    </View>
                    <View style={[S.chipBadge, { backgroundColor: badge.bg, borderWidth: 1, borderColor: badge.border }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: badge.color }}>{badge.label}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}

      </ScrollView>

      {/* ========== NOTIFICATIONS MODAL ========== */}
      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={S.modalBg}>
          <View style={S.modalSheet}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 32 }}>🔕</Text>
                <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>No notifications yet.</Text>
              </View>
            ) : (
              <FlatList
                data={notifications.slice(0, 20)}
                keyExtractor={n => n._id}
                renderItem={({ item }) => {
                  const style = getNotifStyle(item.type);
                  const isUnread = !(item.read || item.isRead);
                  return (
                    <View style={[S.notifItem, { backgroundColor: isUnread ? style.bg : '#fff', borderLeftWidth: 3, borderLeftColor: isUnread ? style.border : 'transparent' }]}>
                      {item.title && <Text style={[S.notifItemTitle, { color: style.color }]}>{item.title}</Text>}
                      <Text style={S.notifItemMsg}>{item.message}</Text>
                      <Text style={S.notifItemTime}>{new Date(item.createdAt).toLocaleString()}</Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ========== MICRO-VERIFICATION MODAL ========== */}
      <Modal visible={showMicroModal} animationType="fade" transparent onRequestClose={() => { setShowMicroModal(false); }}>
        <View style={S.modalBg}>
          <View style={[S.modalSheet, { borderRadius: 20, maxHeight: '85%' }]}>
            <View style={S.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="shield-checkmark" size={20} color="#254B85" />
                <Text style={S.modalTitle}>Photo Verification</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {/* Secret demo toggle */}
                <TouchableOpacity
                  onPress={() => setMockResult(prev => prev === 'pass' ? 'fail' : 'pass')}
                  style={[S.demoToggle, mockResult === 'fail' && { backgroundColor: '#fef2f2' }]}
                >
                  <Ionicons name="flash" size={14} color={mockResult === 'fail' ? '#dc2626' : '#94a3b8'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMicroModal(false)} disabled={verifying}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              {!verifying ? (
                <View style={{ gap: 14 }}>
                  <View style={{ backgroundColor: 'rgba(37,75,133,0.06)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(37,75,133,0.12)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#254B85' }}>
                      Your claim of ₹{disruption?.claimAmount || 700} has been paused due to a network anomaly. Complete verification to release funds.
                    </Text>
                  </View>

                  {/* Liveness Challenge */}
                  {(disruption?.livenessChallenge || disruption?.anomalyChallenge) && (
                    <View style={S.challengeBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                        <Ionicons name="flash" size={12} color="#f59e0b" />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5 }}>VERIFY LIVENESS</Text>
                        <Ionicons name="flash" size={12} color="#f59e0b" />
                      </View>
                      <Text style={S.challengeText}>{disruption?.livenessChallenge || disruption?.anomalyChallenge}</Text>
                      <Text style={[S.timerText, timeLeft < 10 && { color: '#ef4444' }]}>
                        00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                      </Text>
                    </View>
                  )}

                  {/* Camera Feed */}
                  {timeLeft === 0 ? (
                    <View style={{ backgroundColor: '#f8f9fc', padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(37,75,133,0.15)' }}>
                      <Ionicons name="time-outline" size={32} color="#254B85" />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#254B85', marginTop: 8 }}>Time Expired</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Close and restart the verification.</Text>
                    </View>
                  ) : verifyError ? (
                    <View style={{ backgroundColor: '#fffbeb', padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fcd34d' }}>
                      <Ionicons name="warning" size={32} color="#d97706" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e', marginTop: 8, textAlign: 'center' }}>{verifyError}</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      <View style={S.cameraContainer}>
                        {cameraPermission?.granted ? (
                          <CameraView
                            ref={cameraRef}
                            style={S.camera}
                            facing="front"
                            onCameraReady={() => setCameraReady(true)}
                          />
                        ) : (
                          <View style={[S.camera, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }]}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', marginTop: 8 }}>Initializing Camera...</Text>
                          </View>
                        )}
                        <View style={S.cameraOverlay}>
                          <View style={S.liveBadge}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                            <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}>LIVE</Text>
                          </View>
                        </View>
                      </View>

                      <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 8 }}>
                        AASARA Vision AI is monitoring the feed. Position yourself clearly and perform the requested gesture.
                      </Text>

                      <TouchableOpacity
                        style={[S.captureBtn, (timeLeft === 0 || !cameraPermission?.granted) && { opacity: 0.5 }]}
                        onPress={captureAndVerify}
                        disabled={timeLeft === 0 || !cameraPermission?.granted}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="camera" size={20} color="#fff" />
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Capture Live Photo</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 16 }}>
                  <View style={S.verifySpinner}>
                    <ActivityIndicator size="large" color="#0d9488" />
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>Vision AI Processing...</Text>
                  <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    Analyzing authenticity & '<Text style={{ fontWeight: '700', color: '#475569' }}>{disruption?.livenessChallenge || disruption?.anomalyChallenge || 'gesture'}</Text>'
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0fdfa' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  bellBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#254B85', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  logoutChip: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },

  // Subscription Banner
  subBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 14, padding: 14, gap: 12 },
  subBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  subBannerTitle: { fontSize: 13, fontWeight: '700', color: '#065f46' },
  subBannerDesc: { fontSize: 12, color: '#047857', marginTop: 2 },

  // Trigger Card (was Weather Warning)
  triggerCard: { backgroundColor: '#f8fffe', borderWidth: 1, borderColor: 'rgba(56,199,210,0.25)', borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative' as const },
  triggerAccent: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, backgroundColor: '#38C7D2' },
  triggerIconCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#ccfbf1', alignItems: 'center' as const, justifyContent: 'center' as const },
  triggerBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(37,75,133,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const, marginBottom: 4 },
  triggerBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#254B85', letterSpacing: 1, textTransform: 'uppercase' as const },
  triggerTitle: { fontSize: 15, fontWeight: '700' as const, color: '#1A3668', marginBottom: 2 },
  triggerDesc: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  triggerMeta: { fontSize: 11, color: '#94a3b8' },
  smsBadgeNew: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  smsBadgeNewText: { fontSize: 10, fontWeight: '700' as const, color: '#2563eb' },
  dismissBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f8fafc' },

  // Receipt Card (was Payout Card)
  receiptCard: { backgroundColor: '#f8fdfb', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative' as const },
  receiptAccent: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, backgroundColor: '#10b981' },
  receiptIconCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#d1fae5', alignItems: 'center' as const, justifyContent: 'center' as const },
  receiptBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const, marginBottom: 4 },
  receiptBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#059669', letterSpacing: 1, textTransform: 'uppercase' as const },
  receiptTitle: { fontSize: 15, fontWeight: '700' as const, color: '#065f46', marginBottom: 2 },
  receiptBody: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1fae5', borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
  receiptAmount: { fontSize: 26, fontWeight: '800' as const, color: '#059669' },
  receiptDivider: { height: 1, backgroundColor: '#ecfdf5', marginVertical: 6 },
  receiptDetail: { fontSize: 11, color: '#64748b' },
  polygonBtnNew: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: '#254B85', paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  polygonBtnNewText: { fontSize: 12, fontWeight: '800' as const, color: '#5eead4' },

  // Verify Card (updated)
  verifyCardNew: { backgroundColor: '#fffdf7', borderWidth: 1, borderColor: 'rgba(217,119,6,0.2)', borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative' as const },
  verifyAccent: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, backgroundColor: '#f59e0b' },
  verifyIconCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fef3c7', alignItems: 'center' as const, justifyContent: 'center' as const },
  verifyBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const, marginBottom: 4 },
  verifyBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#92400e', letterSpacing: 1, textTransform: 'uppercase' as const },
  verifyBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: 12, backgroundColor: '#d97706' },

  // Frozen / Security Review Card (updated — navy themed)
  frozenCardNew: { backgroundColor: '#f8f9fc', borderWidth: 1, borderColor: 'rgba(37,75,133,0.15)', borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative' as const },
  frozenAccent: { position: 'absolute' as const, top: 0, left: 0, bottom: 0, width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, backgroundColor: '#254B85' },
  frozenIconCircle: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(37,75,133,0.08)', alignItems: 'center' as const, justifyContent: 'center' as const },
  frozenBadge: { backgroundColor: 'rgba(37,75,133,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' as const, marginBottom: 4 },
  frozenBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#254B85', letterSpacing: 1, textTransform: 'uppercase' as const },
  frozenBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: 12, backgroundColor: '#254B85' },

  // Grid
  gridRow: { flexDirection: 'row', gap: 10 },
  gridCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },

  // Platform Header
  platformHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  platformBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  platformLogo: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  // Heartbeat
  heartbeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartbeatDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  heartbeatText: { fontSize: 10, fontWeight: '700', color: '#059669' },

  // Shift Button
  shiftBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  shiftBtnOn: { backgroundColor: '#059669', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  shiftBtnOff: { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  shiftBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Connection
  connectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 10 },

  // Detail Card
  detailCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: '#64748b' },
  detailDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 6 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#134e4a' },

  // Claim Row
  claimRow: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, alignItems: 'center' },
  chipBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  // Action Button
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  // Notification items
  notifItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  notifItemTitle: { fontSize: 13, fontWeight: '700' },
  notifItemMsg: { fontSize: 13, color: '#475569', lineHeight: 18, marginTop: 2 },
  notifItemTime: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // Micro-Verification
  demoToggle: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  challengeBox: { backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#334155', borderRadius: 14, padding: 16, alignItems: 'center' },
  challengeText: { fontSize: 18, fontWeight: '900', color: '#5eead4', textAlign: 'center', marginTop: 4 },
  timerText: { fontSize: 24, fontWeight: '800', color: '#cbd5e1', marginTop: 10, fontVariant: ['tabular-nums'] },
  cameraContainer: { borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: '#1e293b', position: 'relative' },
  camera: { width: '100%', aspectRatio: 4 / 3 },
  cameraOverlay: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(13,148,136,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  captureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0d9488', paddingVertical: 14, borderRadius: 14, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  verifySpinner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },

  // ====== Live GPS Tracking Widget ======
  gpsWidget: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: '#a7f3d0', overflow: 'hidden', width: '100%' },
  gpsWidgetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 8 },
  gpsWidgetTitle: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1.5 },
  gpsPingDot: { position: 'absolute', top: -1, right: -1, width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  gpsSourceBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  gpsSourceText: { fontSize: 9, fontWeight: '700', color: '#ecfdf5' },
  gpsWidgetBody: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f0fdf4', paddingHorizontal: 14, paddingVertical: 12 },
  gpsRadarOuter: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(5,150,105,0.12)', alignItems: 'center', justifyContent: 'center' },
  gpsRadarMiddle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(5,150,105,0.2)', alignItems: 'center', justifyContent: 'center' },
  gpsRadarCenter: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  gpsCoordText: { fontSize: 14, fontWeight: '800', color: '#0f172a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  gpsMetaText: { fontSize: 10, color: '#64748b' },
  gpsMetaDivider: { fontSize: 10, color: '#cbd5e1' },
  gpsDotSmall: { width: 5, height: 5, borderRadius: 2.5 },
});

export default WorkerDashboardScreen;
