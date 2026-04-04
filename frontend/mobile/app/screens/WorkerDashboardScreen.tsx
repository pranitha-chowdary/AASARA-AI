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
  ImageBackground,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

interface Subscription {
  premium: number;
  riskTier: string;
  planType: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface Disruption {
  _id: string;
  disruptionType: string;
  severity: string;
  status: string;
  timestamp: string;
  payoutAmount?: number;
  upiTransactionId?: string;
  txHash?: string;
  anomalyChallenge?: string;
}

interface Claim {
  _id: string;
  eventType: string;
  amount: number;
  flowType: 'A' | 'B';
  status: string;
  createdAt: string;
}

interface NotificationItem {
  _id: string;
  message: string;
  type: string;
  isRead: boolean;
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

  const [shiftLoading, setShiftLoading] = useState(false);
  const [loadingMain, setLoadingMain] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showMicroModal, setShowMicroModal] = useState(false);
  const [microResult, setMicroResult] = useState<'pass' | 'fail' | null>(null);
  const [verifying, setVerifying] = useState(false);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initDashboard();
    return () => cleanup();
  }, []);

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
    pollRef.current = setInterval(fetchAll, 5000);
  };

  const fetchAll = async () => {
    await Promise.allSettled([fetchDisruption(), fetchClaims(), fetchNotifications()]);
  };

  const fetchShiftStatus = async () => {
    try {
      const data = await apiService.getShiftStatus();
      setIsOnline(data?.isOnline ?? false);
    } catch {}
  };

  const fetchSubscription = async () => {
    try {
      const sub = await apiService.getActiveSubscription();
      if (sub) setSubscription(sub);
    } catch {}
  };

  const fetchDisruption = async () => {
    try {
      const data = await apiService.checkActiveDisruption();
      setDisruption(data?.disruption || null);
    } catch {}
  };

  const fetchClaims = async () => {
    try {
      const data = await apiService.fetchClaimsHistory();
      setClaims(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch {}
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiService.fetchNotifications();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch {}
  };

  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 3 * 60 * 1000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };

  const sendHeartbeat = async () => {
    try {
      await apiService.sendHeartbeat();
      const now = new Date();
      setLastPingTime(now);
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
      if (newState) startHeartbeat();
      else { stopHeartbeat(); setLastPingAgo(null); }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update shift status.');
    } finally {
      setShiftLoading(false);
    }
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

  const handleVerifyAnomaly = async () => {
    if (!microResult) { Alert.alert('Select', 'Please choose pass or fail first.'); return; }
    setVerifying(true);
    try {
      await apiService.verifyAnomaly(microResult);
      setShowMicroModal(false);
      setMicroResult(null);
      await fetchDisruption();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAll(), fetchSubscription()]);
    setRefreshing(false);
  }, []);

  if (loadingMain) {
    return (
      <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={S.bg} resizeMode="cover">
        <View style={S.overlay}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0d9488" />
            <Text style={{ marginTop: 12, fontSize: 14, color: '#134e4a' }}>Loading dashboard...</Text>
          </SafeAreaView>
        </View>
      </ImageBackground>
    );
  }

  const disruptionStatus = disruption?.status;

  return (
    <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={S.bg} resizeMode="cover">
      <View style={S.overlay}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={S.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
          >
            {/* HEADER */}
            <View style={S.header}>
              <View style={{ flex: 1 }}>
                <Text style={S.welcome}>👋 {user?.fullName || 'Worker'}</Text>
                <Text style={S.email}>{user?.email}</Text>
                {subscription && (
                  <View style={S.riskTierBadge}>
                    <Text style={S.riskTierText}>{subscription.riskTier}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={S.bellBtn} onPress={handleOpenNotifications}>
                  <Text style={{ fontSize: 22 }}>🔔</Text>
                  {unreadCount > 0 && (
                    <View style={S.bellBadge}>
                      <Text style={S.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
                  <Text style={S.logoutText}>↩ Logout</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SHIFT TOGGLE */}
            <View style={[S.card, { borderLeftWidth: 4, borderLeftColor: isOnline ? '#10b981' : '#94a3b8' }]}>
              <View style={S.row}>
                <View style={{ flex: 1 }}>
                  <Text style={S.cardTitle}>Shift Status</Text>
                  <Text style={{ fontSize: 15, color: isOnline ? '#059669' : '#64748b', marginTop: 4 }}>
                    {isOnline ? '🟢 You are Online & Protected' : '⭕ Shift Inactive'}
                  </Text>
                  {isOnline && lastPingAgo && (
                    <Text style={S.pingText}>Last heartbeat: {lastPingAgo}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[S.toggleBtn, isOnline ? S.toggleOff : S.toggleOn]}
                  onPress={handleShiftToggle}
                  disabled={shiftLoading}
                >
                  {shiftLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={S.toggleBtnText}>{isOnline ? 'End Shift' : 'Start Shift'}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>

            {/* SUBSCRIPTION CARD */}
            {subscription ? (
              <View style={S.card}>
                <Text style={S.cardTitle}>Weekly Protection Plan</Text>
                <View style={[S.row, { marginTop: 10, gap: 16 }]}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>Premium Paid</Text>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#0d9488' }}>
                      ₹{subscription.premium}
                    </Text>
                  </View>
                  <View style={{ width: 1, height: 40, backgroundColor: '#e2e8f0' }} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>Risk Tier</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed' }}>{subscription.riskTier}</Text>
                  </View>
                  <View style={{ width: 1, height: 40, backgroundColor: '#e2e8f0' }} />
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>Plan</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' }}>
                      {subscription.planType === 'premium' ? '⚡ Total Guard' : '🛡️ Basic Shield'}
                    </Text>
                  </View>
                </View>
                {subscription.endDate && (
                  <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                    Active until {new Date(subscription.endDate).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ) : (
              <View style={S.card}>
                <Text style={S.cardTitle}>No Active Plan</Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Complete onboarding to activate protection.</Text>
              </View>
            )}

            {/* NO DISRUPTION */}
            {!disruption && (
              <View style={[S.card, { borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
                <Text style={{ fontSize: 20 }}>✅</Text>
                <Text style={[S.cardTitle, { color: '#059669', marginTop: 4 }]}>No Active Disruptions</Text>
                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Your route is clear. Stay safe!</Text>
              </View>
            )}

            {/* PENDING */}
            {disruption && disruptionStatus === 'pending' && (
              <View style={[S.card, { borderWidth: 2, borderColor: '#ef4444', backgroundColor: '#fff1f1' }]}>
                <View style={S.row}>
                  <Text style={{ fontSize: 28 }}>⚠️</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#ef4444', letterSpacing: 1 }}>DISRUPTION ALERT</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#dc2626', marginTop: 2 }}>
                      {disruption.disruptionType?.toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Severity: {disruption.severity} · {new Date(disruption.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
                <View style={S.tagRow}>
                  <Text style={[S.tag, { backgroundColor: '#fee2e2', color: '#dc2626' }]}>⏳ Claim Processing</Text>
                  <Text style={[S.tag, { backgroundColor: '#fef3c7', color: '#92400e' }]}>💰 Payout Pending</Text>
                </View>
              </View>
            )}

            {/* PAID */}
            {disruption && disruptionStatus === 'paid' && (
              <View style={[S.card, { borderWidth: 2, borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}>
                <View style={S.row}>
                  <Text style={{ fontSize: 28 }}>💸</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#16a34a', letterSpacing: 1 }}>PAYOUT SENT</Text>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#15803d' }}>
                      ₹{disruption.payoutAmount?.toLocaleString() || '---'}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 10, gap: 4 }}>
                  {disruption.upiTransactionId && (
                    <Text style={{ fontSize: 12, color: '#64748b' }}>
                      UPI TX: <Text style={{ fontFamily: 'monospace', color: '#1e293b' }}>{disruption.upiTransactionId}</Text>
                    </Text>
                  )}
                  {disruption.txHash && (
                    <Text style={{ fontSize: 11, color: '#64748b' }}>
                      Blockchain: <Text style={{ fontFamily: 'monospace', fontSize: 10 }}>{disruption.txHash.slice(0, 22)}...</Text>
                    </Text>
                  )}
                  <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Payment verified & settled on-chain.</Text>
                </View>
              </View>
            )}

            {/* MICRO_VERIFY */}
            {disruption && disruptionStatus === 'micro_verify' && (
              <View style={[S.card, { borderWidth: 2, borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}>
                <View style={S.row}>
                  <Text style={{ fontSize: 28 }}>📸</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#d97706', letterSpacing: 1 }}>VERIFICATION REQUIRED</Text>
                    <Text style={{ fontSize: 14, color: '#92400e', marginTop: 2 }}>Upload photo evidence to confirm disruption.</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[S.actionBtn, { backgroundColor: '#d97706', marginTop: 12 }]}
                  onPress={() => setShowMicroModal(true)}
                >
                  <Text style={S.actionBtnText}>📤 Submit Evidence</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* FROZEN_ANOMALY */}
            {disruption && disruptionStatus === 'Frozen_Anomaly' && (
              <View style={[S.card, { borderWidth: 2, borderColor: '#ef4444', backgroundColor: '#fff1f1' }]}>
                <View style={S.row}>
                  <Text style={{ fontSize: 28 }}>🔒</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#dc2626', letterSpacing: 1 }}>SECURITY HOLD</Text>
                    <Text style={{ fontSize: 14, color: '#991b1b', marginTop: 2 }}>
                      Anomaly detected. Payout frozen until micro-verification is complete.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[S.actionBtn, { backgroundColor: '#dc2626', marginTop: 12 }]}
                  onPress={() => setShowMicroModal(true)}
                >
                  <Text style={S.actionBtnText}>🔐 Start Micro-Verification</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CLAIMS HISTORY */}
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>📋 Claims History</Text>
            </View>
            {claims.length === 0 ? (
              <View style={[S.card, { alignItems: 'center', paddingVertical: 24 }]}>
                <Text style={{ fontSize: 28 }}>📪</Text>
                <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>No claims yet.</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Claims appear when disruptions are processed.</Text>
              </View>
            ) : (
              claims.map((claim) => (
                <View key={claim._id} style={S.claimCard}>
                  <View style={S.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>{claim.eventType}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#059669' }}>₹{claim.amount}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={[S.badge, { backgroundColor: claim.flowType === 'A' ? '#dbeafe' : '#fce7f3' }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: claim.flowType === 'A' ? '#1d4ed8' : '#9d174d' }}>
                            Flow {claim.flowType}
                          </Text>
                        </View>
                        <View style={[S.badge, {
                          backgroundColor: claim.status === 'paid' ? '#dcfce7' : claim.status === 'frozen' ? '#fee2e2' : '#fefce8',
                        }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: claim.status === 'paid' ? '#15803d' : claim.status === 'frozen' ? '#dc2626' : '#854d0e' }}>
                            {claim.status?.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotifModal} animationType="slide" transparent onRequestClose={() => setShowNotifModal(false)}>
        <View style={S.modalBg}>
          <View style={S.modalSheet}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>🔔 Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                <Text style={{ fontSize: 22, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {notifications.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontSize: 14 }}>No notifications yet.</Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={n => n._id}
                renderItem={({ item }) => (
                  <View style={[S.notifItem, !item.isRead && { backgroundColor: '#f0fdf4' }]}>
                    <Text style={{ fontSize: 13, color: '#1e293b', lineHeight: 18 }}>{item.message}</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* MICRO-VERIFICATION MODAL */}
      <Modal visible={showMicroModal} animationType="fade" transparent onRequestClose={() => { setShowMicroModal(false); setMicroResult(null); }}>
        <View style={S.modalBg}>
          <View style={[S.modalSheet, { borderRadius: 16 }]}>
            <View style={S.modalHeader}>
              <Text style={S.modalTitle}>🔐 Micro-Verification</Text>
              <TouchableOpacity onPress={() => { setShowMicroModal(false); setMicroResult(null); }}>
                <Text style={{ fontSize: 22, color: '#64748b' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>LIVENESS CHALLENGE</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>
                  {disruption?.anomalyChallenge || 'Please confirm you are currently on the road during this shift.'}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                In production, this requests face liveness verification. For demo, select:
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[S.microChoice, microResult === 'pass' && { backgroundColor: '#dcfce7', borderColor: '#22c55e' }]}
                  onPress={() => setMicroResult('pass')}
                >
                  <Text style={{ fontSize: 24 }}>✅</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d', marginTop: 4 }}>Pass</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Liveness confirmed</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.microChoice, microResult === 'fail' && { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]}
                  onPress={() => setMicroResult('fail')}
                >
                  <Text style={{ fontSize: 24 }}>❌</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626', marginTop: 4 }}>Fail</Text>
                  <Text style={{ fontSize: 11, color: '#64748b' }}>Could not verify</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[S.actionBtn, { backgroundColor: microResult ? '#0d9488' : '#94a3b8' }]}
                onPress={handleVerifyAnomaly}
                disabled={!microResult || verifying}
              >
                {verifying ? <ActivityIndicator color="#fff" /> : <Text style={S.actionBtnText}>Submit Verification</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};

const S = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  scroll: { padding: 20, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  welcome: { fontSize: 20, fontWeight: '700', color: '#134e4a' },
  email: { fontSize: 13, color: '#0f766e', marginTop: 2 },
  riskTierBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  riskTierText: { fontSize: 11, fontWeight: '700', color: '#7c3aed' },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.80)', borderWidth: 1, borderColor: '#99f6e4', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.80)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#99f6e4', justifyContent: 'center' },
  logoutText: { fontSize: 12, color: '#0d9488', fontWeight: '600' },
  card: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(13,148,136,0.18)', padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#134e4a' },
  pingText: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' },
  toggleBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, minWidth: 100, alignItems: 'center' },
  toggleOn: { backgroundColor: '#0d9488' },
  toggleOff: { backgroundColor: '#ef4444' },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  actionBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionHeader: { marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#134e4a' },
  claimCard: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(13,148,136,0.15)', padding: 14, marginBottom: 10 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  notifItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  microChoice: { flex: 1, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', padding: 14, alignItems: 'center', gap: 4, backgroundColor: '#f8fafc' },
});

export default WorkerDashboardScreen;
