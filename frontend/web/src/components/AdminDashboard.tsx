import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, AlertTriangle, CheckCircle2, Zap, Shield,
  RefreshCw, DollarSign, BarChart3, Target,
  XCircle, Loader2, Cpu, FileWarning,
  Truck, ShieldAlert, BadgeCheck, Wifi,
} from 'lucide-react';

const API = 'http://localhost:5001';
const TABS = [
  { id: 'command', label: '🎯 Command Center', icon: Target },
  { id: 'workers', label: '👥 Workers', icon: Users },
  { id: 'claims', label: '📋 Claims', icon: FileWarning },
  { id: 'fraud', label: '🛡️ Fraud', icon: ShieldAlert },
  { id: 'analytics', label: '📊 Analytics', icon: BarChart3 },
];

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('command');
  const [workers, setWorkers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [claimsSummary, setClaimsSummary] = useState<any>({});
  const [analytics, setAnalytics] = useState<any>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [platformData, setPlatformData] = useState<any>(null);
  const [disruptionType, setDisruptionType] = useState('');
  const token = localStorage.getItem('adminToken');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const setL = (k: string, v: boolean) => setLoading(p => ({ ...p, [k]: v }));

  // Auto-dismiss messages
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(null), 5000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(null), 8000); return () => clearTimeout(t); } }, [error]);

  const fetchWorkers = useCallback(async () => {
    setL('workers', true);
    try {
      const res = await fetch(`${API}/api/admin/workers`, { headers });
      const data = await res.json();
      setWorkers(data.workers || []);
    } catch { setError('Failed to load workers'); }
    setL('workers', false);
  }, []);

  const fetchClaims = useCallback(async () => {
    setL('claims', true);
    try {
      const res = await fetch(`${API}/api/admin/claims`, { headers });
      const data = await res.json();
      setClaims(data.claims || []);
      setClaimsSummary(data.summary || {});
    } catch { setError('Failed to load claims'); }
    setL('claims', false);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setL('analytics', true);
    try {
      const res = await fetch(`${API}/api/admin/analytics`, { headers });
      setAnalytics(await res.json());
    } catch { setError('Failed to load analytics'); }
    setL('analytics', false);
  }, []);

  useEffect(() => { fetchWorkers(); fetchClaims(); fetchAnalytics(); }, []);
  useEffect(() => {
    if (activeTab === 'workers') fetchWorkers();
    if (activeTab === 'claims') fetchClaims();
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab]);

  // ========== TRIGGER SCAN ==========
  const runTriggerScan = async () => {
    setL('scan', true); setError(null);
    try {
      const res = await fetch(`${API}/api/admin/run-trigger-scan`, {
        method: 'POST', headers, body: JSON.stringify({ lat: 17.385, lng: 78.4867 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScanResult(data);
      setSuccess(`✅ ${data.message}`);
      fetchClaims(); fetchAnalytics();
    } catch (e: any) { setError(e.message); }
    setL('scan', false);
  };

  // ========== PROCESS CLAIM ==========
  const processClaim = async (claimId: string, action: 'approve' | 'reject') => {
    setL(`claim_${claimId}`, true);
    try {
      const res = await fetch(`${API}/api/admin/process-claim`, {
        method: 'POST', headers, body: JSON.stringify({ claimId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(data.message);
      fetchClaims(); fetchAnalytics();
    } catch (e: any) { setError(e.message); }
    setL(`claim_${claimId}`, false);
  };

  // ========== PLATFORM LOOKUP ==========
  const lookupPlatform = async (workerId: string) => {
    setL('platform', true); setPlatformData(null);
    try {
      const res = await fetch(`${API}/api/admin/platform-lookup`, {
        method: 'POST', headers, body: JSON.stringify({ workerId }),
      });
      setPlatformData(await res.json());
    } catch { setError('Platform lookup failed'); }
    setL('platform', false);
  };

  // ========== TRIGGER DISRUPTION (manual) ==========
  const triggerDisruption = async () => {
    if (!selectedWorker || !disruptionType) return;
    setL('disruption', true);
    try {
      const res = await fetch(`${API}/api/admin/trigger-disruption`, {
        method: 'POST', headers,
        body: JSON.stringify({ workerId: selectedWorker.id, disruptionType, severity: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`✅ ${data.message}`);
      setSelectedWorker(null); setDisruptionType('');
      fetchWorkers();
    } catch (e: any) { setError(e.message); }
    setL('disruption', false);
  };

  // ========== TRIGGER SYNDICATE ATTACK (DEMO) ==========
  const triggerSyndicate = async () => {
    if (!selectedWorker) return setError("Please select a target worker for the simulation first.");
    setL('syndicate', true);
    try {
      const res = await fetch(`${API}/api/admin/trigger-syndicate`, {
        method: 'POST', headers,
        body: JSON.stringify({ workerId: selectedWorker.id, disruptionType: disruptionType || 'monsoon' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`🚨 ${data.message} - ${data.defenseAction}`);
      setSelectedWorker(null); setDisruptionType('');
      fetchWorkers(); fetchClaims(); fetchAnalytics();
    } catch (e: any) { setError(e.message); }
    setL('syndicate', false);
  };

  const fraudColor = (score: number) => score > 70 ? 'text-red-600' : score > 30 ? 'text-amber-600' : 'text-emerald-600';
  const fraudBg = (score: number) => score > 70 ? 'bg-red-50 border-red-200' : score > 30 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto border border-slate-200 shadow-sm">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-teal-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700 text-sm shadow-sm">
            <CheckCircle2 className="w-4 h-4" />{success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm shadow-sm">
            <AlertTriangle className="w-4 h-4" />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== COMMAND CENTER ==================== */}
      {activeTab === 'command' && (
        <div className="space-y-4">
          {/* Run Trigger Scan */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Target className="w-6 h-6 text-purple-600" /> Automated Trigger Scanner
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Scans OpenWeatherMap + simulated APIs for Rain, Heatwave, Pollution, Curfew & Platform Outages
                </p>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={runTriggerScan} disabled={loading.scan}
                className="px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-md">
                {loading.scan ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning...</>
                  : <><Zap className="w-5 h-5" />Run Trigger Scan</>}
              </motion.button>
            </div>

            {/* Scan Results */}
            {scanResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 mt-4">
                <div className="text-sm text-slate-600 mb-2 font-medium">
                  📍 {scanResult.scan?.city || 'Unknown'} • Scanned {scanResult.scan?.total_triggers || 5} triggers
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(scanResult.scan?.triggers || []).map((t: any) => (
                    <div key={t.id} className={`rounded-lg p-3 border text-center ${
                      t.active ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <p className="text-lg">{t.name?.split(' ')[0]}</p>
                      <p className="text-xs font-bold mt-1 text-slate-700 truncate">{t.name?.replace(/[^\w\s/]/g, '').trim()}</p>
                      <p className={`text-xs mt-1 font-bold ${t.active ? 'text-red-600' : 'text-emerald-600'}`}>
                        {t.active ? `⚠️ ACTIVE (S${t.severity})` : '✅ Clear'}
                      </p>
                    </div>
                  ))}
                </div>
                {scanResult.claims && scanResult.claims.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
                    <p className="text-sm font-bold text-slate-800 mb-2">
                      ⚡ {scanResult.claimsCreated} Claims Auto-Processed:
                    </p>
                    {scanResult.claims.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-slate-200 last:border-0 text-xs">
                        <span className="text-slate-700 font-medium">{c.worker}</span>
                        <span className="text-slate-500">{c.trigger}</span>
                        <span className="text-emerald-600 font-bold">₹{c.claimAmount}</span>
                        <span className={fraudColor(c.fraudScore).replace('400', '600')}>F:{Math.round(c.fraudScore)}</span>
                        <span className={c.claimStatus === 'paid' ? 'text-emerald-600 font-bold' : c.claimStatus === 'rejected' ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>
                          {c.claimStatus === 'paid' ? '✅ Paid' : c.claimStatus === 'rejected' ? '🚫 Rejected' : '🔍 Verify'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Workers', value: workers.length, icon: Users, color: 'text-blue-600', iconBg: 'bg-blue-100' },
              { label: 'Active Policies', value: workers.filter(w => w.policyActive).length, icon: Shield, color: 'text-emerald-600', iconBg: 'bg-emerald-100' },
              { label: 'Claims Today', value: claimsSummary.total || 0, icon: FileWarning, color: 'text-amber-600', iconBg: 'bg-amber-100' },
              { label: 'Total Paid', value: `₹${claimsSummary.totalPaidAmount || 0}`, icon: DollarSign, color: 'text-purple-600', iconBg: 'bg-purple-100' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-semibold mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.iconBg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== WORKERS ==================== */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">👥 Enrolled Workers ({workers.length})</h2>
            <button onClick={fetchWorkers} className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 font-semibold">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.workers ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((w, i) => {
              // Heartbeat status logic
              const isOnline = w.isWorking || w.policyActive;
              const pingFresh = w.lastPingTime && !w.pingStale;
              const heartbeatLabel = !isOnline 
                ? '🔴 Offline' 
                : pingFresh 
                  ? `🟢 Online (ping: ${Math.round((w.pingAgeMs || 0) / 1000)}s ago)` 
                  : `🟡 Online (stale: ${w.lastPingTime ? Math.round((w.pingAgeMs || 0) / 1000) + 's ago' : 'never'})`;
              const flowLabel = !isOnline ? '' : pingFresh ? 'Flow A' : 'Flow B (SMS)';
              
              return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-md transition-all shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800">{w.fullName}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    !isOnline ? 'bg-slate-100 text-slate-500' :
                    pingFresh ? 'bg-emerald-100 text-emerald-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {heartbeatLabel}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-500 mb-3 font-medium">
                  <p>📧 {w.email}</p>
                  <p>📱 {w.platform || 'Not linked'} • {w.subscriptionStatus === 'active' ? '✅ Subscribed' : '❌ No plan'}</p>
                  {w.subscriptionAmount && <p className="text-slate-600">💰 Premium: ₹{w.subscriptionAmount} • {w.riskTier || 'N/A'}</p>}
                  {isOnline && flowLabel && (
                    <p className={`font-bold mt-1.5 ${pingFresh ? 'text-emerald-600' : 'text-amber-600'}`}>
                      ⚡ Trigger will use: {flowLabel}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => lookupPlatform(w.id)}
                      className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-blue-100 transition-colors">
                      <Truck className="w-3 h-3" /> Platform
                    </button>
                    <button onClick={() => setSelectedWorker(w)} disabled={!isOnline}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition-colors disabled:opacity-40">
                      <Zap className="w-3 h-3" /> Disrupt
                    </button>
                  </div>
                  <button 
                    onClick={() => { setSelectedWorker(w); setActiveTab('fraud'); }}
                    disabled={!isOnline}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border border-red-200 transition-all disabled:opacity-40 shadow-sm shadow-red-100"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Target for Heist Demo
                  </button>
                </div>
              </motion.div>
            )})}
          </div>

          {/* Platform Lookup Modal */}
          {platformData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPlatformData(null)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">🚚 Platform Telemetry</h3>
                  <button onClick={() => setPlatformData(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><XCircle className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-slate-500">Worker: <span className="text-slate-900 font-bold">{platformData.worker?.fullName}</span></p>
                    <p className="text-slate-500">Platform: <span className="text-slate-800 font-medium">{platformData.platformData?.platform}</span></p>
                    <p className="text-slate-500">Status: <span className={`font-bold ${platformData.platformData?.is_active ? 'text-emerald-600' : 'text-red-600'}`}>
                      {platformData.platformData?.status || 'unknown'}
                    </span></p>
                    <p className="text-slate-500">Zone: <span className="text-slate-800 font-medium">{platformData.platformData?.current_zone}, {platformData.platformData?.city}</span></p>
                  </div>
                  {platformData.platformData?.current_order && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-700 font-bold text-xs mb-1">🏍️ ACTIVE DELIVERY</p>
                      <p className="text-slate-900 font-semibold text-sm">{platformData.platformData.current_order.restaurant}</p>
                      <p className="text-slate-600 text-xs mt-0.5">{platformData.platformData.current_order.items?.join(', ')}</p>
                      <p className="text-slate-700 text-xs mt-1 font-medium">₹{platformData.platformData.current_order.order_value} • {platformData.platformData.current_order.distance_km}km</p>
                      <p className="text-emerald-700 font-bold text-xs mt-0.5">ETA: {platformData.platformData.current_order.estimated_delivery}</p>
                    </div>
                  )}
                  {platformData.platformData?.today_stats && (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-600 mb-2">📊 TODAY'S STATS</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div><p className="text-xl font-bold text-slate-800">{platformData.platformData.today_stats.orders_completed}</p><p className="text-slate-500">Orders</p></div>
                        <div><p className="text-xl font-bold text-emerald-600">₹{platformData.platformData.today_stats.earnings}</p><p className="text-slate-500">Earnings</p></div>
                        <div><p className="text-xl font-bold text-blue-600">{platformData.platformData.today_stats.online_hours}h</p><p className="text-slate-500">Online</p></div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Manual Disruption Modal */}
          <AnimatePresence>
            {selectedWorker && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
                  onClick={() => setSelectedWorker(null)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-0 flex items-center justify-center p-4 z-50">
                  <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-6 max-w-md w-full space-y-4">
                    <h3 className="text-lg font-bold text-slate-900">⚡ Trigger Disruption for {selectedWorker.fullName}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { v: 'monsoon', l: '🌧️ Monsoon', c: 'from-blue-500 to-cyan-500 shadow-blue-200' },
                        { v: 'heatwave', l: '🔥 Heatwave', c: 'from-orange-500 to-red-500 shadow-orange-200' },
                        { v: 'curfew', l: '🚨 Curfew', c: 'from-red-500 to-pink-500 shadow-red-200' },
                        { v: 'pollution', l: '💨 Pollution', c: 'from-amber-400 to-orange-500 shadow-amber-200' },
                        { v: 'strike', l: '⛔ Strike', c: 'from-purple-500 to-pink-500 shadow-purple-200' },
                      ].map(o => (
                        <button key={o.v} onClick={() => setDisruptionType(o.v)}
                          className={`p-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${disruptionType === o.v ? `bg-gradient-to-r ${o.c} text-white` : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setSelectedWorker(null); setDisruptionType(''); }}
                        className="flex-1 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg font-semibold hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
                      <button onClick={triggerDisruption} disabled={!disruptionType || loading.disruption}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-colors">
                        {loading.disruption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Trigger
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ==================== CLAIMS PIPELINE ==================== */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📋 Claims Pipeline</h2>
            <button onClick={fetchClaims} className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 font-semibold">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.claims ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Claims Summary */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { l: 'Total', v: claimsSummary.total || 0, c: 'text-blue-600' },
              { l: 'Paid', v: claimsSummary.paid || 0, c: 'text-emerald-600' },
              { l: 'Pending', v: (claimsSummary.pending || 0) + (claimsSummary.microVerify || 0), c: 'text-amber-600' },
              { l: 'Rejected', v: claimsSummary.rejected || 0, c: 'text-red-600' },
              { l: 'Avg Fraud', v: claimsSummary.avgFraudScore || 0, c: (claimsSummary.avgFraudScore || 0) > 30 ? 'text-amber-600' : 'text-emerald-600' },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-slate-200 shadow-sm rounded-lg p-3 text-center">
                <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                <p className="text-xs text-slate-500 font-medium">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Claims Table */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-slate-600 font-semibold">Worker</th>
                  <th className="p-3 text-slate-600 font-semibold">Type</th>
                  <th className="p-3 text-slate-600 font-semibold">Amount</th>
                  <th className="p-3 text-slate-600 font-semibold">Fraud</th>
                  <th className="p-3 text-slate-600 font-semibold">Status</th>
                  <th className="p-3 text-slate-600 font-semibold">Source</th>
                  <th className="p-3 text-slate-600 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c, i) => (
                  <motion.tr key={c.transactionId || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3">
                      <p className="text-slate-800 font-bold text-xs">{c.workerName || 'Unknown'}</p>
                      <p className="text-slate-500 text-xs">{c.workerEmail || ''}</p>
                    </td>
                    <td className="p-3 text-center text-xs font-semibold text-slate-600 capitalize">{c.disruptionType || c.triggerSource || 'N/A'}</td>
                    <td className="p-3 text-center text-emerald-600 font-black">₹{c.amount}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold text-xs ${fraudColor(c.fraudScore || 0)}`}>{Math.round(c.fraudScore || 0)}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        c.status === 'paid' ? 'bg-emerald-100 text-emerald-700'
                        : c.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : c.status === 'micro_verify' ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>
                        {c.status === 'paid' ? '💰 Paid' : c.status === 'rejected' ? '🚫 Rejected' : c.status === 'micro_verify' ? '🔍 Verify' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs font-medium text-slate-500">
                      {c.autoTriggered ? '🤖 Auto' : '👤 Manual'}
                    </td>
                    <td className="p-3 text-center">
                      {(c.status === 'pending' || c.status === 'micro_verify' || c.status === 'approved') && (
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => processClaim(c.transactionId, 'approve')}
                            disabled={loading[`claim_${c.transactionId}`]}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-xs font-bold transition-colors">
                            {loading[`claim_${c.transactionId}`] ? '...' : '✅ Approve'}
                          </button>
                          <button onClick={() => processClaim(c.transactionId, 'reject')}
                            disabled={loading[`claim_${c.transactionId}`]}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded text-xs font-bold transition-colors">
                            {loading[`claim_${c.transactionId}`] ? '...' : '🚫 Reject'}
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {claims.length === 0 && (
                  <tr><td colSpan={7} className="p-12 text-center text-slate-500 font-medium bg-slate-50">No claims yet. Run a Trigger Scan to auto-generate claims.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FRAUD DETECTION ==================== */}
      {activeTab === 'fraud' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" /> Fraud Detection & Anti-Spoofing
            </h2>
            <button
              onClick={triggerSyndicate}
              disabled={loading.syndicate || !selectedWorker}
              className={`px-4 py-2 text-sm font-bold rounded-lg shadow-sm border transition-all flex items-center gap-2 ${
                !selectedWorker 
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-red-500/10'
              }`}
            >
              {loading.syndicate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              {loading.syndicate ? 'Simulating Attack...' : 'Trigger Syndicate Attack'}
            </button>
          </div>

          {!selectedWorker && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
              ⚠️ Please select a worker from the <strong>Workers</strong> tab first using the "Target for Heist Demo" button.
            </div>
          )}

          {/* 3-Layer Architecture */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: 'Layer 1: Sensor Fusion', icon: Cpu, desc: 'GPS teleportation, path linearity, accelerometer stillness, barometric pressure', color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50/50' },
              { title: 'Layer 2: Syndicate Detection', icon: Wifi, desc: 'Temporal clustering, IP subnet analysis, platform telemetry cross-check', color: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50/50' },
              { title: 'Layer 3: UX Protection', icon: BadgeCheck, desc: 'Graceful degradation, micro-verification fallback, clean history discount', color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/50' },
            ].map((layer, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`bg-white border ${layer.border} rounded-xl p-4 shadow-sm relative overflow-hidden`}>
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${layer.bg} opacity-50`} />
                <layer.icon className={`w-6 h-6 ${layer.color} mb-2 relative z-10`} />
                <h3 className="text-sm font-bold text-slate-800 mb-1 relative z-10">{layer.title}</h3>
                <p className="text-xs text-slate-600 relative z-10">{layer.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Flagged Claims */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">{`🚨 Flagged Claims (Fraud Score > 30)`}</h3>
            <div className="space-y-2">
              {claims.filter(c => (c.fraudScore || 0) > 30).length === 0 ? (
                <p className="text-slate-500 font-medium text-sm text-center py-4 bg-slate-50 rounded-lg border border-slate-100">✅ No suspicious claims detected</p>
              ) : (
                claims.filter(c => (c.fraudScore || 0) > 30).map((c, i) => (
                  <div key={i} className={`border rounded-lg p-3 flex items-center justify-between shadow-sm ${fraudBg(c.fraudScore || 0)}`}>
                    <div>
                      <p className="text-slate-800 text-sm font-bold">{c.workerName}</p>
                      <p className="text-slate-600 text-xs font-semibold mt-0.5">{c.disruptionType} • <span className="text-emerald-600">₹{c.amount}</span></p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${fraudColor(c.fraudScore || 0)}`}>{Math.round(c.fraudScore || 0)}</p>
                      <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Fraud Score</p>
                    </div>
                    <div className="flex gap-1.5 pl-4 border-l border-slate-200/50 ml-2">
                      <button onClick={() => processClaim(c.transactionId, 'approve')}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold transition-colors">Override ✅</button>
                      <button onClick={() => processClaim(c.transactionId, 'reject')}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors">Reject 🚫</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Anti-Spoofing Info */}
          <div className="bg-gradient-to-r from-red-50 to-purple-50 border border-red-100 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">🛡️ Zero-Trust Verification Architecture</h3>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-700 font-medium">
              <div>
                <p className="font-extrabold text-slate-900 mb-2">Detection Capabilities:</p>
                <ul className="space-y-1">
                  <li>{`• GPS teleportation (>500m jumps)`}</li>
                  <li>• Robotic/linear path patterns</li>
                  <li>• Device stillness (phone on table)</li>
                  <li>• Barometric pressure anomalies</li>
                </ul>
              </div>
              <div>
                <p className="font-extrabold text-slate-900 mb-2">Syndicate Defense:</p>
                <ul className="space-y-1">
                  <li>• 500+ node coordinated attack detection</li>
                  <li>• IP subnet / VPN clustering</li>
                  <li>• Platform telemetry cross-check</li>
                  <li>• Temporal geofence analysis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ANALYTICS ==================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">📊 Analytics Dashboard</h2>
            <button onClick={fetchAnalytics} className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 font-semibold">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.analytics ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {analytics ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: 'Total Workers', v: analytics.workers?.total || 0, sub: `${analytics.workers?.active || 0} active`, c: 'text-blue-600', iconBg: 'bg-blue-50' },
                  { l: 'Premium Revenue', v: `₹${analytics.financials?.totalPremiumRevenue || 0}`, sub: `${analytics.workers?.subscribed || 0} subscribed`, c: 'text-emerald-600', iconBg: 'bg-emerald-50' },
                  { l: 'Total Payouts', v: `₹${analytics.financials?.totalPayouts || 0}`, sub: `${analytics.claims?.paid || 0} claims paid`, c: 'text-purple-600', iconBg: 'bg-purple-50' },
                  { l: 'Pool Balance', v: `₹${Math.max(0, analytics.financials?.poolBalance || 0)}`, sub: 'Liquidity Pool', c: 'text-cyan-600', iconBg: 'bg-cyan-50' },
                ].map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                    <p className={`text-2xl font-black ${m.c}`}>{m.v}</p>
                    <p className="text-sm font-bold text-slate-800 mt-1">{m.l}</p>
                    <p className="text-xs font-medium text-slate-500">{m.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Claims & Fraud */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">📋 Claims Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { l: 'Paid', v: analytics.claims?.paid || 0, c: 'bg-emerald-500' },
                      { l: 'Pending', v: analytics.claims?.pending || 0, c: 'bg-blue-500' },
                      { l: 'Micro-Verify', v: analytics.claims?.microVerify || 0, c: 'bg-amber-500' },
                      { l: 'Rejected', v: analytics.claims?.rejected || 0, c: 'bg-red-500' },
                    ].map((item, i) => {
                      const total = analytics.claims?.total || 1;
                      const pct = Math.round((item.v / total) * 100) || 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-600 w-20">{item.l}</span>
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.1 }}
                              className={`h-full ${item.c} rounded-full`} />
                          </div>
                          <span className="text-xs text-slate-800 font-bold w-8 text-right">{item.v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-3">🛡️ Fraud Metrics</h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className={`text-2xl font-black ${(analytics.fraud?.avgFraudScore || 0) > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {analytics.fraud?.avgFraudScore || 0}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Avg Score</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-2xl font-black text-red-600">{analytics.fraud?.flagged || 0}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Flagged</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-2xl font-black text-blue-600">{analytics.fraud?.detectionRate || '0%'}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Detection Rate</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                      <p className="text-2xl font-black text-purple-600">{analytics.disruptions?.total || 0}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Disruptions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liquidity Pool */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-blue-100 shadow-sm rounded-xl p-6">
                <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-600" /> Community Liquidity Pool
                </h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-black text-cyan-700">₹{Math.max(0, analytics.financials?.poolBalance || 0)}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">Pool Balance</p>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-emerald-600">₹{analytics.financials?.totalPremiumRevenue || 0}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">Total Contributions</p>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-purple-600">₹{analytics.financials?.totalPayouts || 0}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">Total Payouts</p>
                  </div>
                  <div>
                    <p className={`text-3xl font-black ${(analytics.financials?.netMargin || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(analytics.financials?.netMargin || 0) >= 0 ? '+' : ''}₹{analytics.financials?.netMargin || 0}
                    </p>
                    <p className="text-sm font-bold text-slate-500 mt-1">Net Margin</p>
                  </div>
                </div>
              </motion.div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 font-medium">Loading analytics...</div>
          )}
        </div>
      )}
    </div>
  );
}
