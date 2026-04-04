import React, { useState, useEffect, useCallback } from 'react';
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
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

type AdminTab = 'command' | 'workers' | 'claims' | 'fraud' | 'analytics';

interface Worker {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  platform?: string;
  policyActive?: boolean;
  isWorking?: boolean;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  riskTier?: string;
  lastPingTime?: string;
  pingStale?: boolean;
  pingAgeMs?: number;
}

interface Claim {
  transactionId: string;
  workerName?: string;
  workerEmail?: string;
  disruptionType?: string;
  triggerSource?: string;
  amount: number;
  fraudScore?: number;
  status: string;
  autoTriggered?: boolean;
  payoutMethod?: string;
  createdAt?: string;
}

const fraudColor = (score: number) => {
  if (score > 70) return '#dc2626';
  if (score > 40) return '#d97706';
  return '#16a34a';
};

const fraudBg = (score: number) => {
  if (score > 70) return '#fef2f2';
  if (score > 40) return '#fffbeb';
  return '#f0fdf4';
};

const DISRUPTION_OPTIONS = [
  { v: 'monsoon',   l: '🌊 Flood: Ward K/E – Andheri East',     c: '#3b82f6' },
  { v: 'heatwave',  l: '🔥 Heatwave: Zone 4 – Bandra West',     c: '#ef4444' },
  { v: 'curfew',    l: '🚨 Curfew: Sector 7 – Dharavi',          c: '#8b5cf6' },
  { v: 'pollution', l: '💨 Smog: AQI>400 – Andheri North',       c: '#d97706' },
  { v: 'strike',    l: '⛔ Strike: NH-8 – Gurgaon Hub',           c: '#ec4899' },
];

const AdminDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('command');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsSummary, setClaimsSummary] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [blackSwanResult, setBlackSwanResult] = useState<any>(null);
  const [suspendEnrollments, setSuspendEnrollments] = useState(false);
  const [platformData, setPlatformData] = useState<any>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [disruptionType, setDisruptionType] = useState('');
  const [showDisruptModal, setShowDisruptModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);

  const [loading, setLoading] = useState<Record<string, boolean>>({
    init: true, scan: false, workers: false, claims: false,
    analytics: false, syndicate: false, blackSwan: false, disruption: false,
  });

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const setLoad = (key: string, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(null), type === 'success' ? 5000 : 8000);
  };

  const fetchWorkers = useCallback(async () => {
    setLoad('workers', true);
    try {
      const list = await apiService.getAllWorkers();
      setWorkers(list);
    } catch { /* silent */ }
    setLoad('workers', false);
  }, []);

  const fetchClaims = useCallback(async () => {
    setLoad('claims', true);
    try {
      const data = await apiService.getAdminClaims();
      setClaims(data.claims || []);
      setClaimsSummary(data.summary || {});
    } catch { /* silent */ }
    setLoad('claims', false);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoad('analytics', true);
    try {
      const data = await apiService.getAdminAnalytics();
      setAnalytics(data);
    } catch { /* silent */ }
    setLoad('analytics', false);
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchWorkers(), fetchClaims(), fetchAnalytics()]);
      setLoad('init', false);
    };
    init();
  }, []);

  const runTriggerScan = async () => {
    setLoad('scan', true);
    setScanResult(null);
    try {
      const data = await apiService.runTriggerScan(17.385, 78.4867);
      setScanResult(data);
      showBanner('success', `✅ Scan complete — ${data.claimsCreated || 0} claims auto-processed`);
      await fetchClaims();
    } catch (err: any) {
      showBanner('error', err?.response?.data?.error || 'Trigger scan failed');
    }
    setLoad('scan', false);
  };

  const processClaim = async (claimId: string, action: 'approve' | 'reject') => {
    setLoad(`claim_${claimId}`, true);
    try {
      await apiService.processClaim(claimId, action);
      showBanner('success', `Claim ${action === 'approve' ? 'approved ✅' : 'rejected 🚫'}`);
      await fetchClaims();
    } catch (err: any) {
      showBanner('error', err?.response?.data?.error || 'Failed to process claim');
    }
    setLoad(`claim_${claimId}`, false);
  };

  const lookupPlatform = async (workerId: string) => {
    try {
      const data = await apiService.platformLookup(workerId);
      setPlatformData(data);
      setShowPlatformModal(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Platform lookup failed');
    }
  };

  const triggerDisruption = async () => {
    if (!selectedWorker || !disruptionType) return;
    setLoad('disruption', true);
    try {
      await apiService.triggerDisruption(selectedWorker.id, disruptionType, 'high');
      setShowDisruptModal(false);
      setDisruptionType('');
      showBanner('success', `⚡ Disruption triggered for ${selectedWorker.fullName}`);
      await fetchClaims();
    } catch (err: any) {
      showBanner('error', err?.response?.data?.error || 'Disruption trigger failed');
    }
    setLoad('disruption', false);
  };

  const triggerSyndicate = async () => {
    if (!selectedWorker) {
      showBanner('error', '⚠️ Select a worker from Workers tab first');
      return;
    }
    setLoad('syndicate', true);
    try {
      await apiService.triggerSyndicate(selectedWorker.id, disruptionType || 'monsoon');
      showBanner('success', `🛡️ Syndicate attack simulated for ${selectedWorker.fullName}`);
      await fetchClaims();
    } catch (err: any) {
      showBanner('error', err?.response?.data?.error || 'Syndicate simulation failed');
    }
    setLoad('syndicate', false);
  };

  const simulateBlackSwan = async () => {
    Alert.alert(
      '⚠️ Confirm Black Swan',
      'Simulate 14 days of max-severity payouts for ALL workers?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate', style: 'destructive', onPress: async () => {
            setLoad('blackSwan', true);
            setBlackSwanResult(null);
            try {
              const data = await apiService.simulateBlackSwan({ days: 14, disruptionType: 'monsoon' });
              setBlackSwanResult(data);
              if (data.poolDrained || data.suspendEnrollments) setSuspendEnrollments(true);
              showBanner('success', `Black Swan complete — Pool ${data.poolDrained ? 'DRAINED ⚠️' : 'survived ✅'}`);
            } catch (err: any) {
              showBanner('error', err?.response?.data?.error || 'Black Swan simulation failed');
            }
            setLoad('blackSwan', false);
          }
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => logout(), style: 'destructive' },
    ]);
  };

  if (loading.init) {
    return (
      <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container}>
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#f97316" />
              <Text style={styles.loadingText}>Loading admin panel...</Text>
            </View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    );
  }

  // ─────────────────────────── RENDER ────────────────────────────

  return (
    <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Admin Control</Text>
              <Text style={styles.headerSub}>{user?.email}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Banner */}
          {banner && (
            <View style={[styles.banner, banner.type === 'success' ? styles.bannerSuccess : styles.bannerError]}>
              <Text style={[styles.bannerText, banner.type === 'success' ? styles.bannerTextSuccess : styles.bannerTextError]}>
                {banner.msg}
              </Text>
            </View>
          )}

          {/* Suspend Enrollments Alert */}
          {suspendEnrollments && (
            <View style={styles.suspendBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.suspendTitle}>⛔ SUSPEND ENROLLMENTS</Text>
                <Text style={styles.suspendSub}>Liquidity Pool Critically Low — new policy issuance suspended.</Text>
              </View>
              <TouchableOpacity onPress={() => setSuspendEnrollments(false)}>
                <Text style={styles.suspendClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tab Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
            {([
              { k: 'command', l: '🎯 Command' },
              { k: 'workers', l: '👥 Workers' },
              { k: 'claims',  l: '📋 Claims' },
              { k: 'fraud',   l: '🛡️ Fraud' },
              { k: 'analytics', l: '📊 Analytics' },
            ] as { k: AdminTab; l: string }[]).map(tab => (
              <TouchableOpacity
                key={tab.k}
                style={[styles.tabItem, activeTab === tab.k && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.k)}
              >
                <Text style={[styles.tabLabel, activeTab === tab.k && styles.tabLabelActive]}>{tab.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ===== TAB CONTENT ===== */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={false} onRefresh={async () => { await fetchWorkers(); await fetchClaims(); await fetchAnalytics(); }} tintColor="#0d9488" />}
          >

            {/* ==================== COMMAND CENTER ==================== */}
            {activeTab === 'command' && (
              <View style={{ gap: 16 }}>

                {/* Trigger Scan Card */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🎯 Automated Trigger Scanner</Text>
                  <Text style={styles.cardDesc}>Scans OpenWeatherMap + simulated APIs for Rain, Heatwave, Pollution, Curfew & Platform Outages</Text>
                  <TouchableOpacity
                    style={[styles.tealBtn, loading.scan && styles.btnDisabled]}
                    onPress={runTriggerScan}
                    disabled={loading.scan}
                  >
                    {loading.scan
                      ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.tealBtnText}>  Scanning...</Text></>
                      : <Text style={styles.tealBtnText}>⚡ Run Trigger Scan</Text>
                    }
                  </TouchableOpacity>

                  {scanResult && (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      <Text style={styles.smallMeta}>
                        📍 {scanResult.scan?.city || 'Unknown'} • {scanResult.scan?.total_triggers || 5} triggers scanned
                      </Text>
                      <View style={styles.triggerGrid}>
                        {(scanResult.scan?.triggers || []).map((t: any, i: number) => (
                          <View key={i} style={[styles.triggerChip, { backgroundColor: t.active ? '#fef2f2' : '#f8fafc', borderColor: t.active ? '#fca5a5' : '#e2e8f0' }]}>
                            <Text style={styles.triggerChipName}>{t.name?.split(' ')[0]}</Text>
                            <Text style={[styles.triggerChipStatus, { color: t.active ? '#dc2626' : '#16a34a' }]}>
                              {t.active ? `⚠️ S${t.severity}` : '✅'}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {(scanResult.claims || []).length > 0 && (
                        <View style={styles.scanClaimBox}>
                          <Text style={styles.scanClaimTitle}>⚡ {scanResult.claimsCreated} Claims Auto-Processed:</Text>
                          {(scanResult.claims || []).map((c: any, i: number) => (
                            <View key={i} style={styles.scanClaimRow}>
                              <Text style={styles.scanClaimWorker}>{c.worker}</Text>
                              <Text style={[styles.scanClaimAmt, { color: '#16a34a', fontWeight: '700' }]}>₹{c.claimAmount}</Text>
                              <Text style={[styles.scanClaimStatus, {
                                color: c.claimStatus === 'paid' ? '#16a34a' : c.claimStatus === 'rejected' ? '#dc2626' : '#d97706',
                              }]}>
                                {c.claimStatus === 'paid' ? '✅ Paid' : c.claimStatus === 'rejected' ? '🚫 Rejected' : '🔍 Verify'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Quick Stats */}
                <View style={styles.statsGrid}>
                  {[
                    { l: 'Workers', v: workers.length, c: '#3b82f6' },
                    { l: 'Active', v: workers.filter(w => w.policyActive).length, c: '#16a34a' },
                    { l: 'Claims', v: claimsSummary.total || 0, c: '#d97706' },
                    { l: 'Paid', v: `₹${claimsSummary.totalPaidAmount || 0}`, c: '#8b5cf6' },
                  ].map((s, i) => (
                    <View key={i} style={styles.statCard}>
                      <Text style={[styles.statValue, { color: s.c }]}>{s.v}</Text>
                      <Text style={styles.statLabel}>{s.l}</Text>
                    </View>
                  ))}
                </View>

                {/* Black Swan */}
                <View style={[styles.card, styles.blackSwanCard]}>
                  <Text style={[styles.cardTitle, { color: '#dc2626' }]}>🦢 Black Swan Stress Test</Text>
                  <Text style={styles.cardDesc}>
                    Fires 14 consecutive days of max-severity payouts to drain the liquidity pool and trigger the Suspend Enrollments protocol.
                  </Text>
                  <TouchableOpacity
                    style={[styles.redBtn, loading.blackSwan && styles.btnDisabled]}
                    onPress={simulateBlackSwan}
                    disabled={loading.blackSwan}
                  >
                    {loading.blackSwan
                      ? <><ActivityIndicator size="small" color="#fff" /><Text style={styles.redBtnText}>  Simulating...</Text></>
                      : <Text style={styles.redBtnText}>⚡ Simulate 14-Day Black Swan</Text>
                    }
                  </TouchableOpacity>

                  {blackSwanResult && (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      <View style={styles.bsKpiRow}>
                        {[
                          { l: 'Days', v: blackSwanResult.simulationDays || 14, c: '#374151' },
                          { l: 'Workers Hit', v: blackSwanResult.workersAffected || 0, c: '#d97706' },
                          { l: 'Payouts', v: `₹${blackSwanResult.totalPayouts || 0}`, c: '#dc2626' },
                          { l: 'Final Pool', v: `₹${blackSwanResult.finalPoolBalance || 0}`, c: blackSwanResult.poolDrained ? '#dc2626' : '#d97706' },
                        ].map((k, i) => (
                          <View key={i} style={styles.bsKpi}>
                            <Text style={[styles.bsKpiVal, { color: k.c }]}>{k.v}</Text>
                            <Text style={styles.bsKpiLabel}>{k.l}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Pool drain bar chart */}
                      <View style={styles.poolBarWrap}>
                        <Text style={styles.poolBarTitle}>📉 Pool Balance Drain — Day by Day</Text>
                        <View style={styles.poolBarsRow}>
                          {(blackSwanResult.events || []).map((e: any, i: number) => {
                            const maxBal = blackSwanResult.seedBalance || 1;
                            const pct = Math.max(4, Math.round((e.runningBalance / maxBal) * 100));
                            return (
                              <View key={i} style={styles.poolBarCol}>
                                <View style={[styles.poolBar, {
                                  height: pct * 0.6,
                                  backgroundColor: e.poolDrained ? '#ef4444' : pct < 30 ? '#f59e0b' : '#06b6d4',
                                }]} />
                                <Text style={styles.poolBarDay}>D{e.day}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {blackSwanResult.poolDrained && (
                        <View style={styles.poolDrainAlert}>
                          <Text style={styles.poolDrainText}>
                            ⚠️ Pool drained on Day {(blackSwanResult.events || []).find((e: any) => e.poolDrained)?.day ?? '—'}. Enrollment suspension protocol activated.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ==================== WORKERS ==================== */}
            {activeTab === 'workers' && (
              <View style={{ gap: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>👥 Enrolled Workers ({workers.length})</Text>
                  <TouchableOpacity onPress={fetchWorkers} style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>{loading.workers ? '↻ …' : '↻ Refresh'}</Text>
                  </TouchableOpacity>
                </View>

                {workers.length === 0 ? (
                  <Text style={styles.emptyText}>No workers enrolled yet.</Text>
                ) : workers.map((w, i) => {
                  const isOnline = w.isWorking || w.policyActive;
                  const pingFresh = !w.pingStale && !!w.lastPingTime;
                  const hbLabel = !isOnline ? '🔴 Offline' : pingFresh ? `🟢 Online (${Math.round((w.pingAgeMs || 0) / 1000)}s ago)` : `🟡 Stale`;

                  return (
                    <View key={w.id} style={styles.workerCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.workerName}>{w.fullName}</Text>
                        <Text style={[styles.hbBadge, { backgroundColor: !isOnline ? '#f1f5f9' : pingFresh ? '#dcfce7' : '#fef3c7', color: !isOnline ? '#64748b' : pingFresh ? '#15803d' : '#92400e' }]}>
                          {hbLabel}
                        </Text>
                      </View>
                      <Text style={styles.workerMeta}>📧 {w.email}</Text>
                      <Text style={styles.workerMeta}>📱 {w.platform || 'Not linked'} • {w.subscriptionStatus === 'active' ? '✅ Subscribed' : '❌ No plan'}</Text>
                      {w.subscriptionAmount && (
                        <Text style={styles.workerMeta}>💰 Premium: ₹{w.subscriptionAmount} • {w.riskTier || 'N/A'}</Text>
                      )}

                      <View style={styles.workerActions}>
                        <TouchableOpacity
                          style={styles.platformBtn}
                          onPress={() => lookupPlatform(w.id)}
                        >
                          <Text style={styles.platformBtnText}>🚚 Platform</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.disruptBtn, !isOnline && styles.btnDisabled]}
                          disabled={!isOnline}
                          onPress={() => { setSelectedWorker(w); setDisruptionType(''); setShowDisruptModal(true); }}
                        >
                          <Text style={styles.disruptBtnText}>⚡ Disrupt</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={[styles.heistBtn, !isOnline && styles.btnDisabled]}
                        disabled={!isOnline}
                        onPress={() => { setSelectedWorker(w); setActiveTab('fraud'); }}
                      >
                        <Text style={styles.heistBtnText}>🎯 Target for Heist Demo</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ==================== CLAIMS ==================== */}
            {activeTab === 'claims' && (
              <View style={{ gap: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>📋 Claims Pipeline</Text>
                  <TouchableOpacity onPress={fetchClaims} style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>{loading.claims ? '↻ …' : '↻ Refresh'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Summary Stats */}
                <View style={styles.claimStatsRow}>
                  {[
                    { l: 'Total', v: claimsSummary.total || 0, c: '#3b82f6' },
                    { l: 'Paid', v: claimsSummary.paid || 0, c: '#16a34a' },
                    { l: 'Pending', v: (claimsSummary.pending || 0) + (claimsSummary.microVerify || 0), c: '#d97706' },
                    { l: 'Rejected', v: claimsSummary.rejected || 0, c: '#dc2626' },
                    { l: 'Avg Fraud', v: claimsSummary.avgFraudScore || 0, c: (claimsSummary.avgFraudScore || 0) > 30 ? '#d97706' : '#16a34a' },
                  ].map((s, i) => (
                    <View key={i} style={styles.claimStat}>
                      <Text style={[styles.claimStatVal, { color: s.c }]}>{s.v}</Text>
                      <Text style={styles.claimStatLabel}>{s.l}</Text>
                    </View>
                  ))}
                </View>

                {claims.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No claims yet. Run a Trigger Scan to auto-generate claims.</Text>
                  </View>
                ) : claims.map((c, i) => (
                  <View key={c.transactionId || i} style={styles.claimCard}>
                    <View style={styles.rowBetween}>
                      <View>
                        <Text style={styles.claimWorker}>{c.workerName || 'Unknown'}</Text>
                        <Text style={styles.claimEmail}>{c.workerEmail || ''}</Text>
                      </View>
                      <Text style={[styles.claimAmt]}>₹{c.amount}</Text>
                    </View>
                    <View style={[styles.rowBetween, { marginTop: 8 }]}>
                      <Text style={styles.claimType}>{c.disruptionType || c.triggerSource || 'N/A'}</Text>
                      <Text style={[styles.fraudScore, { color: fraudColor(c.fraudScore || 0) }]}>
                        F:{Math.round(c.fraudScore || 0)}
                      </Text>
                      <View style={[styles.statusBadge, {
                        backgroundColor: c.status === 'paid' ? '#dcfce7' : c.status === 'rejected' ? '#fee2e2' : c.status === 'micro_verify' ? '#fef3c7' : '#dbeafe',
                      }]}>
                        <Text style={[styles.statusBadgeText, {
                          color: c.status === 'paid' ? '#15803d' : c.status === 'rejected' ? '#dc2626' : c.status === 'micro_verify' ? '#92400e' : '#1d4ed8',
                        }]}>
                          {c.status === 'paid' ? '💰 Paid' : c.status === 'rejected' ? '🚫 Rejected' : c.status === 'micro_verify' ? '🔍 Verify' : '⏳ Pending'}
                        </Text>
                      </View>
                      <Text style={styles.claimSource}>{c.autoTriggered ? '🤖 Auto' : '👤 Manual'}</Text>
                    </View>

                    {(c.status === 'pending' || c.status === 'micro_verify' || c.status === 'approved') && (
                      <View style={styles.claimActions}>
                        <TouchableOpacity
                          style={[styles.approveBtn, loading[`claim_${c.transactionId}`] && styles.btnDisabled]}
                          onPress={() => processClaim(c.transactionId, 'approve')}
                          disabled={!!loading[`claim_${c.transactionId}`]}
                        >
                          <Text style={styles.approveBtnText}>{loading[`claim_${c.transactionId}`] ? '…' : '✅ Approve'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtn, loading[`claim_${c.transactionId}`] && styles.btnDisabled]}
                          onPress={() => processClaim(c.transactionId, 'reject')}
                          disabled={!!loading[`claim_${c.transactionId}`]}
                        >
                          <Text style={styles.rejectBtnText}>{loading[`claim_${c.transactionId}`] ? '…' : '🚫 Reject'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* ==================== FRAUD ==================== */}
            {activeTab === 'fraud' && (
              <View style={{ gap: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>🛡️ Fraud Detection</Text>
                  <TouchableOpacity
                    style={[styles.syndicateBtn, (loading.syndicate || !selectedWorker) && styles.btnDisabled]}
                    onPress={triggerSyndicate}
                    disabled={loading.syndicate || !selectedWorker}
                  >
                    <Text style={styles.syndicateBtnText}>
                      {loading.syndicate ? '↻ Simulating…' : '🎯 Syndicate Attack'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!selectedWorker && (
                  <View style={styles.warnBox}>
                    <Text style={styles.warnText}>⚠️ Select a worker from the Workers tab using "Target for Heist Demo" first.</Text>
                  </View>
                )}

                {selectedWorker && (
                  <View style={[styles.card, { backgroundColor: 'rgba(254,242,242,0.90)', borderColor: '#fca5a5' }]}>
                    <Text style={styles.cardTitle}>🎯 Target: {selectedWorker.fullName}</Text>
                    <Text style={styles.cardDesc}>{selectedWorker.email}</Text>
                  </View>
                )}

                {/* 3-Layer Architecture */}
                {[
                  { title: 'Layer 1: Sensor Fusion', desc: 'GPS teleportation, path linearity, accelerometer stillness, barometric pressure', color: '#3b82f6', bg: '#eff6ff' },
                  { title: 'Layer 2: Syndicate Detection', desc: 'Temporal clustering, IP subnet analysis, platform telemetry cross-check', color: '#8b5cf6', bg: '#f5f3ff' },
                  { title: 'Layer 3: UX Protection', desc: 'Graceful degradation, micro-verification fallback, clean history discount', color: '#16a34a', bg: '#f0fdf4' },
                ].map((layer, i) => (
                  <View key={i} style={[styles.layerCard, { borderColor: layer.color, backgroundColor: layer.bg }]}>
                    <Text style={[styles.layerTitle, { color: layer.color }]}>{layer.title}</Text>
                    <Text style={styles.layerDesc}>{layer.desc}</Text>
                  </View>
                ))}

                {/* Flagged Claims */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>🚨 Flagged Claims (Fraud Score &gt; 30)</Text>
                  {claims.filter(c => (c.fraudScore || 0) > 30).length === 0 ? (
                    <Text style={styles.emptyText}>✅ No suspicious claims detected</Text>
                  ) : claims.filter(c => (c.fraudScore || 0) > 30).map((c, i) => (
                    <View key={i} style={[styles.fraudClaimRow, { backgroundColor: fraudBg(c.fraudScore || 0) }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.claimWorker}>{c.workerName}</Text>
                        <Text style={styles.claimType}>{c.disruptionType} • <Text style={{ color: '#16a34a' }}>₹{c.amount}</Text></Text>
                      </View>
                      <View style={{ alignItems: 'center', marginHorizontal: 10 }}>
                        <Text style={[styles.bigFraudScore, { color: fraudColor(c.fraudScore || 0) }]}>{Math.round(c.fraudScore || 0)}</Text>
                        <Text style={styles.fraudScoreLabel}>Fraud</Text>
                      </View>
                      <View style={{ gap: 4 }}>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => processClaim(c.transactionId, 'approve')}>
                          <Text style={styles.approveBtnText}>Override ✅</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => processClaim(c.transactionId, 'reject')}>
                          <Text style={styles.rejectBtnText}>Reject 🚫</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Anti-Spoofing Info */}
                <View style={[styles.card, { backgroundColor: 'rgba(253,244,255,0.90)' }]}>
                  <Text style={styles.cardTitle}>🛡️ Zero-Trust Architecture</Text>
                  <Text style={styles.layerDesc}>Detection: GPS teleportation (&gt;500m jumps), robotic/linear path patterns, device stillness, barometric pressure anomalies.</Text>
                  <Text style={[styles.layerDesc, { marginTop: 8 }]}>Syndicate Defense: 500+ node coordinated attack detection, IP subnet/VPN clustering, platform telemetry cross-check, temporal geofence analysis.</Text>
                </View>
              </View>
            )}

            {/* ==================== ANALYTICS ==================== */}
            {activeTab === 'analytics' && (
              <View style={{ gap: 12 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>📊 Analytics Dashboard</Text>
                  <TouchableOpacity onPress={fetchAnalytics} style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>{loading.analytics ? '↻ …' : '↻ Refresh'}</Text>
                  </TouchableOpacity>
                </View>

                {!analytics ? (
                  <ActivityIndicator color="#0d9488" />
                ) : (
                  <>
                    {/* Key Metrics */}
                    <View style={styles.analyticsGrid}>
                      {[
                        { l: 'Total Workers', v: analytics.workers?.total || 0, sub: `${analytics.workers?.active || 0} active`, c: '#3b82f6' },
                        { l: 'Premium Revenue', v: `₹${analytics.financials?.totalPremiumRevenue || 0}`, sub: `${analytics.workers?.subscribed || 0} subscribed`, c: '#16a34a' },
                        { l: 'Total Payouts', v: `₹${analytics.financials?.totalPayouts || 0}`, sub: `${analytics.claims?.paid || 0} paid`, c: '#8b5cf6' },
                        { l: 'Pool Balance', v: `₹${Math.max(0, analytics.financials?.poolBalance || 0)}`, sub: 'Liquidity Pool', c: '#06b6d4' },
                      ].map((m, i) => (
                        <View key={i} style={styles.analyticsCard}>
                          <Text style={[styles.analyticsVal, { color: m.c }]}>{m.v}</Text>
                          <Text style={styles.analyticsLabel}>{m.l}</Text>
                          <Text style={styles.analyticsSub}>{m.sub}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Claims Breakdown */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>📋 Claims Breakdown</Text>
                      {[
                        { l: 'Paid', v: analytics.claims?.paid || 0, c: '#16a34a' },
                        { l: 'Pending', v: analytics.claims?.pending || 0, c: '#3b82f6' },
                        { l: 'Micro-Verify', v: analytics.claims?.microVerify || 0, c: '#d97706' },
                        { l: 'Rejected', v: analytics.claims?.rejected || 0, c: '#dc2626' },
                      ].map((item, i) => {
                        const total = analytics.claims?.total || 1;
                        const pct = Math.round((item.v / total) * 100) || 0;
                        return (
                          <View key={i} style={{ marginBottom: 8 }}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.claimType}>{item.l}</Text>
                              <Text style={[styles.claimType, { color: item.c, fontWeight: '700' }]}>{item.v}</Text>
                            </View>
                            <View style={styles.progressTrack}>
                              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: item.c }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Fraud Metrics */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>🛡️ Fraud Metrics</Text>
                      <View style={styles.fraudMetricsGrid}>
                        {[
                          { l: 'Avg Score', v: analytics.fraud?.avgFraudScore || 0, c: (analytics.fraud?.avgFraudScore || 0) > 30 ? '#d97706' : '#16a34a' },
                          { l: 'Flagged', v: analytics.fraud?.flagged || 0, c: '#dc2626' },
                          { l: 'Detection Rate', v: analytics.fraud?.detectionRate || '0%', c: '#3b82f6' },
                          { l: 'Disruptions', v: analytics.disruptions?.total || 0, c: '#8b5cf6' },
                        ].map((m, i) => (
                          <View key={i} style={styles.fraudMetricCard}>
                            <Text style={[styles.analyticsVal, { color: m.c, fontSize: 22 }]}>{m.v}</Text>
                            <Text style={styles.analyticsSub}>{m.l}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Liquidity Pool */}
                    <View style={[styles.card, { backgroundColor: 'rgba(236,254,255,0.90)', borderColor: '#67e8f9' }]}>
                      <Text style={styles.cardTitle}>💧 Community Liquidity Pool</Text>
                      <View style={styles.poolGrid}>
                        {[
                          { l: 'Pool Balance', v: `₹${Math.max(0, analytics.financials?.poolBalance || 0)}`, c: '#0891b2' },
                          { l: 'Contributions', v: `₹${analytics.financials?.totalPremiumRevenue || 0}`, c: '#16a34a' },
                          { l: 'Payouts', v: `₹${analytics.financials?.totalPayouts || 0}`, c: '#8b5cf6' },
                          { l: 'Net Margin', v: `${(analytics.financials?.netMargin || 0) >= 0 ? '+' : ''}₹${analytics.financials?.netMargin || 0}`, c: (analytics.financials?.netMargin || 0) >= 0 ? '#16a34a' : '#dc2626' },
                        ].map((p, i) => (
                          <View key={i} style={styles.poolCard}>
                            <Text style={[styles.analyticsVal, { color: p.c, fontSize: 18 }]}>{p.v}</Text>
                            <Text style={styles.analyticsSub}>{p.l}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

          </ScrollView>

          {/* ==================== DISRUPTION MODAL ==================== */}
          <Modal visible={showDisruptModal} transparent animationType="slide" onRequestClose={() => setShowDisruptModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>⚡ Trigger Disruption{selectedWorker ? ` for ${selectedWorker.fullName}` : ''}</Text>
                {DISRUPTION_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.v}
                    style={[styles.disruptionOption, disruptionType === o.v && { borderColor: o.c, backgroundColor: `${o.c}18` }]}
                    onPress={() => setDisruptionType(o.v)}
                  >
                    <Text style={[styles.disruptionOptionText, disruptionType === o.v && { color: o.c, fontWeight: '700' }]}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDisruptModal(false); setDisruptionType(''); }}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.triggerModalBtn, (!disruptionType || loading.disruption) && styles.btnDisabled]}
                    onPress={triggerDisruption}
                    disabled={!disruptionType || loading.disruption}
                  >
                    {loading.disruption
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.triggerModalBtnText}>⚡ Trigger</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ==================== PLATFORM MODAL ==================== */}
          <Modal visible={showPlatformModal} transparent animationType="slide" onRequestClose={() => setShowPlatformModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.rowBetween}>
                  <Text style={styles.modalTitle}>🚚 Platform Telemetry</Text>
                  <TouchableOpacity onPress={() => setShowPlatformModal(false)}>
                    <Text style={{ fontSize: 18, color: '#64748b' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {platformData && (
                  <ScrollView style={{ maxHeight: 400 }}>
                    <View style={styles.platformSection}>
                      <Text style={styles.platformLabel}>Worker: <Text style={styles.platformValue}>{platformData.worker?.fullName}</Text></Text>
                      <Text style={styles.platformLabel}>Platform: <Text style={styles.platformValue}>{platformData.platformData?.platform}</Text></Text>
                      <Text style={styles.platformLabel}>Status: <Text style={[styles.platformValue, { color: platformData.platformData?.is_active ? '#16a34a' : '#dc2626' }]}>{platformData.platformData?.status || 'unknown'}</Text></Text>
                      <Text style={styles.platformLabel}>Zone: <Text style={styles.platformValue}>{platformData.platformData?.current_zone}, {platformData.platformData?.city}</Text></Text>
                    </View>

                    {platformData.platformData?.current_order && (
                      <View style={[styles.platformSection, { backgroundColor: '#eff6ff', borderColor: '#93c5fd' }]}>
                        <Text style={[styles.platformLabel, { color: '#1d4ed8', fontWeight: '700' }]}>🏍️ ACTIVE DELIVERY</Text>
                        <Text style={styles.platformValue}>{platformData.platformData.current_order.restaurant}</Text>
                        <Text style={styles.platformLabel}>{platformData.platformData.current_order.items?.join(', ')}</Text>
                        <Text style={styles.platformLabel}>₹{platformData.platformData.current_order.order_value} • {platformData.platformData.current_order.distance_km}km</Text>
                        <Text style={[styles.platformLabel, { color: '#16a34a', fontWeight: '700' }]}>ETA: {platformData.platformData.current_order.estimated_delivery}</Text>
                      </View>
                    )}

                    {platformData.platformData?.today_stats && (
                      <View style={styles.platformSection}>
                        <Text style={[styles.platformLabel, { fontWeight: '700', marginBottom: 8 }]}>📊 TODAY'S STATS</Text>
                        <View style={styles.statsGrid}>
                          <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#374151' }]}>{platformData.platformData.today_stats.orders_completed}</Text>
                            <Text style={styles.statLabel}>Orders</Text>
                          </View>
                          <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#16a34a' }]}>₹{platformData.platformData.today_stats.earnings}</Text>
                            <Text style={styles.statLabel}>Earnings</Text>
                          </View>
                          <View style={styles.statCard}>
                            <Text style={[styles.statValue, { color: '#3b82f6' }]}>{platformData.platformData.today_stats.online_hours}h</Text>
                            <Text style={styles.statLabel}>Online</Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                )}
                <TouchableOpacity style={[styles.tealBtn, { marginTop: 12 }]} onPress={() => setShowPlatformModal(false)}>
                  <Text style={styles.tealBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bgImage: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#134e4a' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#134e4a' },
  headerSub: { fontSize: 12, color: '#0f766e', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#99f6e4' },
  logoutText: { fontSize: 12, color: '#0d9488', fontWeight: '600' },

  banner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  bannerSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bannerError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bannerText: { fontSize: 13, fontWeight: '600' },
  bannerTextSuccess: { color: '#15803d' },
  bannerTextError: { color: '#dc2626' },

  suspendBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dc2626', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12, gap: 8 },
  suspendTitle: { color: '#fff', fontWeight: '900', fontSize: 13 },
  suspendSub: { color: '#fecaca', fontSize: 11, marginTop: 2 },
  suspendClose: { color: '#fff', fontSize: 18, paddingLeft: 8 },

  tabBar: { maxHeight: 44, marginBottom: 4 },
  tabBarContent: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  tabItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.55)' },
  tabItemActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabLabelActive: { color: '#fff' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  card: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(13,148,136,0.20)' },
  blackSwanCard: { borderWidth: 2, borderColor: '#fca5a5', backgroundColor: 'rgba(254,242,242,0.88)' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#134e4a', marginBottom: 6 },
  cardDesc: { fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 17 },

  tealBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  tealBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  redBtn: { backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  redBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },

  smallMeta: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  triggerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  triggerChip: { borderRadius: 8, borderWidth: 1, padding: 8, alignItems: 'center', minWidth: 56 },
  triggerChipName: { fontSize: 16 },
  triggerChipStatus: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  scanClaimBox: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10, gap: 4 },
  scanClaimTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 4 },
  scanClaimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  scanClaimWorker: { fontSize: 11, color: '#374151', fontWeight: '600', flex: 1 },
  scanClaimAmt: { fontSize: 11 },
  scanClaimStatus: { fontSize: 11, fontWeight: '700', marginLeft: 8 },

  statsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 72, backgroundColor: 'rgba(255,255,255,0.80)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(13,148,136,0.15)', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#64748b', fontWeight: '500', marginTop: 2 },

  bsKpiRow: { flexDirection: 'row', gap: 6 },
  bsKpi: { flex: 1, backgroundColor: 'rgba(255,255,255,0.80)', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  bsKpiVal: { fontSize: 14, fontWeight: '900' },
  bsKpiLabel: { fontSize: 9, color: '#64748b', marginTop: 2, textAlign: 'center' },
  poolBarWrap: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 10 },
  poolBarTitle: { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 8 },
  poolBarsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 2 },
  poolBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  poolBar: { width: '100%', borderRadius: 2 },
  poolBarDay: { fontSize: 7, color: '#94a3b8', marginTop: 2 },
  poolDrainAlert: { backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', padding: 10 },
  poolDrainText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#134e4a' },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 8, borderWidth: 1, borderColor: '#99f6e4' },
  refreshText: { fontSize: 12, color: '#0d9488', fontWeight: '600' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(13,148,136,0.15)' },
  emptyText: { fontSize: 13, color: '#64748b', textAlign: 'center' },

  workerCard: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(13,148,136,0.20)', gap: 4 },
  workerName: { fontSize: 14, fontWeight: '700', color: '#134e4a' },
  workerMeta: { fontSize: 12, color: '#64748b' },
  hbBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  workerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  platformBtn: { flex: 1, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  platformBtnText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  disruptBtn: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  disruptBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  heistBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  heistBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '700' },

  claimStatsRow: { flexDirection: 'row', gap: 6 },
  claimStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.80)', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(13,148,136,0.15)' },
  claimStatVal: { fontSize: 18, fontWeight: '900' },
  claimStatLabel: { fontSize: 9, color: '#64748b', marginTop: 1 },

  claimCard: { backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(13,148,136,0.20)' },
  claimWorker: { fontSize: 13, fontWeight: '700', color: '#134e4a' },
  claimEmail: { fontSize: 11, color: '#64748b' },
  claimAmt: { fontSize: 18, fontWeight: '900', color: '#16a34a' },
  claimType: { fontSize: 12, color: '#64748b', textTransform: 'capitalize' },
  fraudScore: { fontSize: 12, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  claimSource: { fontSize: 10, color: '#64748b' },
  claimActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  approveBtnText: { fontSize: 12, color: '#15803d', fontWeight: '700' },
  rejectBtn: { flex: 1, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  rejectBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '700' },

  syndicateBtn: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  syndicateBtnText: { fontSize: 12, color: '#dc2626', fontWeight: '700' },
  warnBox: { backgroundColor: '#fefce8', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', padding: 12 },
  warnText: { fontSize: 13, color: '#92400e', fontWeight: '500' },
  layerCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  layerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  layerDesc: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  fraudClaimRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  bigFraudScore: { fontSize: 22, fontWeight: '900' },
  fraudScoreLabel: { fontSize: 9, color: '#64748b' },

  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  analyticsCard: { width: '48%', backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(13,148,136,0.15)' },
  analyticsVal: { fontSize: 20, fontWeight: '900' },
  analyticsLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 2 },
  analyticsSub: { fontSize: 10, color: '#64748b', marginTop: 1 },
  fraudMetricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fraudMetricCard: { width: '48%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  poolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  poolCard: { width: '48%', padding: 8, alignItems: 'center' },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#134e4a' },
  disruptionOption: { padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  disruptionOptionText: { fontSize: 13, color: '#374151' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  cancelBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  triggerModalBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#dc2626', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  triggerModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  platformSection: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 10, gap: 3 },
  platformLabel: { fontSize: 12, color: '#64748b' },
  platformValue: { color: '#134e4a', fontWeight: '600' },
});

export default AdminDashboardScreen;
