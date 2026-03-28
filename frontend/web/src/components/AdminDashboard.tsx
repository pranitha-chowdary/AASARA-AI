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

  const fraudColor = (score: number) => score > 70 ? 'text-red-400' : score > 30 ? 'text-yellow-400' : 'text-green-400';
  const fraudBg = (score: number) => score > 70 ? 'bg-red-500/10 border-red-500/30' : score > 30 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-900/30 border border-green-700 rounded-lg p-3 flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />{success}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== COMMAND CENTER ==================== */}
      {activeTab === 'command' && (
        <div className="space-y-4">
          {/* Run Trigger Scan */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-700/40 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="w-6 h-6 text-purple-400" /> Automated Trigger Scanner
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Scans OpenWeatherMap + simulated APIs for Rain, Heatwave, Pollution, Curfew & Platform Outages
                </p>
              </div>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={runTriggerScan} disabled={loading.scan}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-900/30">
                {loading.scan ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning...</>
                  : <><Zap className="w-5 h-5" />Run Trigger Scan</>}
              </motion.button>
            </div>

            {/* Scan Results */}
            {scanResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 mt-4">
                <div className="text-sm text-slate-300 mb-2">
                  📍 {scanResult.scan?.city || 'Unknown'} • Scanned {scanResult.scan?.total_triggers || 5} triggers
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(scanResult.scan?.triggers || []).map((t: any) => (
                    <div key={t.id} className={`rounded-lg p-3 border text-center ${
                      t.active ? 'bg-red-900/30 border-red-500/50' : 'bg-slate-800/50 border-slate-700'
                    }`}>
                      <p className="text-lg">{t.name?.split(' ')[0]}</p>
                      <p className="text-xs font-bold mt-1 truncate">{t.name?.replace(/[^\w\s/]/g, '').trim()}</p>
                      <p className={`text-xs mt-1 font-bold ${t.active ? 'text-red-400' : 'text-green-400'}`}>
                        {t.active ? `⚠️ ACTIVE (S${t.severity})` : '✅ Clear'}
                      </p>
                    </div>
                  ))}
                </div>
                {scanResult.claims && scanResult.claims.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mt-2">
                    <p className="text-sm font-bold text-white mb-2">
                      ⚡ {scanResult.claimsCreated} Claims Auto-Processed:
                    </p>
                    {scanResult.claims.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0 text-xs">
                        <span className="text-slate-300">{c.worker}</span>
                        <span className="text-slate-400">{c.trigger}</span>
                        <span className="text-green-400 font-bold">₹{c.claimAmount}</span>
                        <span className={fraudColor(c.fraudScore)}>F:{Math.round(c.fraudScore)}</span>
                        <span className={c.claimStatus === 'paid' ? 'text-green-400' : c.claimStatus === 'rejected' ? 'text-red-400' : 'text-yellow-400'}>
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
              { label: 'Total Workers', value: workers.length, icon: Users, color: 'text-blue-400', bg: 'from-blue-900/30 to-blue-800/20' },
              { label: 'Active Policies', value: workers.filter(w => w.policyActive).length, icon: Shield, color: 'text-green-400', bg: 'from-green-900/30 to-green-800/20' },
              { label: 'Claims Today', value: claimsSummary.total || 0, icon: FileWarning, color: 'text-yellow-400', bg: 'from-yellow-900/30 to-yellow-800/20' },
              { label: 'Total Paid', value: `₹${claimsSummary.totalPaidAmount || 0}`, icon: DollarSign, color: 'text-purple-400', bg: 'from-purple-900/30 to-purple-800/20' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-gradient-to-br ${stat.bg} border border-slate-700/50 rounded-xl p-4`}>
                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== WORKERS ==================== */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">👥 Enrolled Workers ({workers.length})</h2>
            <button onClick={fetchWorkers} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.workers ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((w, i) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-purple-500/40 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white">{w.fullName}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${w.policyActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {w.policyActive ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-400 mb-3">
                  <p>📧 {w.email}</p>
                  <p>📱 {w.platform || 'Not linked'} • {w.subscriptionStatus === 'active' ? '✅ Subscribed' : '❌ No plan'}</p>
                  {w.subscriptionAmount && <p>💰 Premium: ₹{w.subscriptionAmount} • {w.riskTier || 'N/A'}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => lookupPlatform(w.id)}
                    className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
                    <Truck className="w-3 h-3" /> Platform
                  </button>
                  <button onClick={() => setSelectedWorker(w)} disabled={!w.policyActive}
                    className="flex-1 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-30">
                    <Zap className="w-3 h-3" /> Disrupt
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Platform Lookup Modal */}
          {platformData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPlatformData(null)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">🚚 Platform Telemetry</h3>
                  <button onClick={() => setPlatformData(null)} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400">Worker: <span className="text-white font-bold">{platformData.worker?.fullName}</span></p>
                    <p className="text-slate-400">Platform: <span className="text-white">{platformData.platformData?.platform}</span></p>
                    <p className="text-slate-400">Status: <span className={platformData.platformData?.is_active ? 'text-green-400' : 'text-red-400'}>
                      {platformData.platformData?.status || 'unknown'}
                    </span></p>
                    <p className="text-slate-400">Zone: <span className="text-white">{platformData.platformData?.current_zone}, {platformData.platformData?.city}</span></p>
                  </div>
                  {platformData.platformData?.current_order && (
                    <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                      <p className="text-blue-400 font-bold text-xs mb-1">🏍️ ACTIVE DELIVERY</p>
                      <p className="text-white text-xs">{platformData.platformData.current_order.restaurant}</p>
                      <p className="text-slate-400 text-xs">{platformData.platformData.current_order.items?.join(', ')}</p>
                      <p className="text-slate-400 text-xs">₹{platformData.platformData.current_order.order_value} • {platformData.platformData.current_order.distance_km}km</p>
                      <p className="text-green-400 text-xs">ETA: {platformData.platformData.current_order.estimated_delivery}</p>
                    </div>
                  )}
                  {platformData.platformData?.today_stats && (
                    <div className="bg-slate-800 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-300 mb-2">📊 TODAY'S STATS</p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div><p className="text-xl font-bold text-white">{platformData.platformData.today_stats.orders_completed}</p><p className="text-slate-500">Orders</p></div>
                        <div><p className="text-xl font-bold text-green-400">₹{platformData.platformData.today_stats.earnings}</p><p className="text-slate-500">Earnings</p></div>
                        <div><p className="text-xl font-bold text-blue-400">{platformData.platformData.today_stats.online_hours}h</p><p className="text-slate-500">Online</p></div>
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
                  onClick={() => setSelectedWorker(null)} className="fixed inset-0 bg-black/50 z-40" />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-0 flex items-center justify-center p-4 z-50">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4">
                    <h3 className="text-lg font-bold text-white">⚡ Trigger Disruption for {selectedWorker.fullName}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { v: 'monsoon', l: '🌧️ Monsoon', c: 'from-blue-600 to-cyan-600' },
                        { v: 'heatwave', l: '🔥 Heatwave', c: 'from-orange-600 to-red-600' },
                        { v: 'curfew', l: '🚨 Curfew', c: 'from-red-600 to-pink-600' },
                        { v: 'pollution', l: '💨 Pollution', c: 'from-amber-600 to-orange-600' },
                        { v: 'strike', l: '⛔ Strike', c: 'from-purple-600 to-pink-600' },
                      ].map(o => (
                        <button key={o.v} onClick={() => setDisruptionType(o.v)}
                          className={`p-2.5 rounded-lg text-sm font-semibold transition-all ${disruptionType === o.v ? `bg-gradient-to-r ${o.c} text-white` : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                          {o.l}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setSelectedWorker(null); setDisruptionType(''); }}
                        className="flex-1 py-2 bg-slate-700 text-slate-200 rounded-lg font-semibold">Cancel</button>
                      <button onClick={triggerDisruption} disabled={!disruptionType || loading.disruption}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
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
            <h2 className="text-lg font-bold text-white">📋 Claims Pipeline</h2>
            <button onClick={fetchClaims} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.claims ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Claims Summary */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { l: 'Total', v: claimsSummary.total || 0, c: 'text-blue-400' },
              { l: 'Paid', v: claimsSummary.paid || 0, c: 'text-green-400' },
              { l: 'Pending', v: (claimsSummary.pending || 0) + (claimsSummary.microVerify || 0), c: 'text-yellow-400' },
              { l: 'Rejected', v: claimsSummary.rejected || 0, c: 'text-red-400' },
              { l: 'Avg Fraud', v: claimsSummary.avgFraudScore || 0, c: (claimsSummary.avgFraudScore || 0) > 30 ? 'text-yellow-400' : 'text-green-400' },
            ].map((s, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-xs text-slate-400">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Claims Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700">
                  <th className="text-left p-3 text-slate-400 font-normal">Worker</th>
                  <th className="p-3 text-slate-400 font-normal">Type</th>
                  <th className="p-3 text-slate-400 font-normal">Amount</th>
                  <th className="p-3 text-slate-400 font-normal">Fraud</th>
                  <th className="p-3 text-slate-400 font-normal">Status</th>
                  <th className="p-3 text-slate-400 font-normal">Source</th>
                  <th className="p-3 text-slate-400 font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c, i) => (
                  <motion.tr key={c.transactionId || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-slate-800/50 hover:bg-slate-700/20">
                    <td className="p-3">
                      <p className="text-white font-semibold text-xs">{c.workerName || 'Unknown'}</p>
                      <p className="text-slate-500 text-xs">{c.workerEmail || ''}</p>
                    </td>
                    <td className="p-3 text-center text-xs text-slate-300">{c.disruptionType || c.triggerSource || 'N/A'}</td>
                    <td className="p-3 text-center text-green-400 font-bold">₹{c.amount}</td>
                    <td className="p-3 text-center">
                      <span className={`font-bold text-xs ${fraudColor(c.fraudScore || 0)}`}>{Math.round(c.fraudScore || 0)}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        c.status === 'paid' ? 'bg-green-500/20 text-green-400'
                        : c.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                        : c.status === 'micro_verify' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {c.status === 'paid' ? '💰 Paid' : c.status === 'rejected' ? '🚫 Rejected' : c.status === 'micro_verify' ? '🔍 Verify' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-xs text-slate-500">
                      {c.autoTriggered ? '🤖 Auto' : '👤 Manual'}
                    </td>
                    <td className="p-3 text-center">
                      {(c.status === 'pending' || c.status === 'micro_verify' || c.status === 'approved') && (
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => processClaim(c.transactionId, 'approve')}
                            disabled={loading[`claim_${c.transactionId}`]}
                            className="px-2 py-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded text-xs font-bold">
                            {loading[`claim_${c.transactionId}`] ? '...' : '✅'}
                          </button>
                          <button onClick={() => processClaim(c.transactionId, 'reject')}
                            disabled={loading[`claim_${c.transactionId}`]}
                            className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs font-bold">
                            🚫
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {claims.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">No claims yet. Run a Trigger Scan to auto-generate claims.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FRAUD DETECTION ==================== */}
      {activeTab === 'fraud' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Fraud Detection & Anti-Spoofing
          </h2>

          {/* 3-Layer Architecture */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: 'Layer 1: Sensor Fusion', icon: Cpu, desc: 'GPS teleportation, path linearity, accelerometer stillness, barometric pressure', color: 'text-blue-400', border: 'border-blue-500/30' },
              { title: 'Layer 2: Syndicate Detection', icon: Wifi, desc: 'Temporal clustering, IP subnet analysis, platform telemetry cross-check', color: 'text-purple-400', border: 'border-purple-500/30' },
              { title: 'Layer 3: UX Protection', icon: BadgeCheck, desc: 'Graceful degradation, micro-verification fallback, clean history discount', color: 'text-green-400', border: 'border-green-500/30' },
            ].map((layer, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`bg-slate-800/50 border ${layer.border} rounded-xl p-4`}>
                <layer.icon className={`w-6 h-6 ${layer.color} mb-2`} />
                <h3 className="text-sm font-bold text-white mb-1">{layer.title}</h3>
                <p className="text-xs text-slate-400">{layer.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Flagged Claims */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">{`🚨 Flagged Claims (Fraud Score > 30)`}</h3>
            <div className="space-y-2">
              {claims.filter(c => (c.fraudScore || 0) > 30).length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">✅ No suspicious claims detected</p>
              ) : (
                claims.filter(c => (c.fraudScore || 0) > 30).map((c, i) => (
                  <div key={i} className={`border rounded-lg p-3 flex items-center justify-between ${fraudBg(c.fraudScore || 0)}`}>
                    <div>
                      <p className="text-white text-sm font-bold">{c.workerName}</p>
                      <p className="text-slate-400 text-xs">{c.disruptionType} • ₹{c.amount}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${fraudColor(c.fraudScore || 0)}`}>{Math.round(c.fraudScore || 0)}</p>
                      <p className="text-xs text-slate-400">Fraud Score</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => processClaim(c.transactionId, 'approve')}
                        className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-xs font-bold">Override ✅</button>
                      <button onClick={() => processClaim(c.transactionId, 'reject')}
                        className="px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs font-bold">Reject 🚫</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Anti-Spoofing Info */}
          <div className="bg-gradient-to-r from-red-900/10 to-purple-900/10 border border-red-700/20 rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-2">🛡️ Zero-Trust Verification Architecture</h3>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
              <div>
                <p className="font-bold text-slate-300 mb-1">Detection Capabilities:</p>
                <ul className="space-y-0.5">
                  <li>{`• GPS teleportation (>500m jumps)`}</li>
                  <li>• Robotic/linear path patterns</li>
                  <li>• Device stillness (phone on table)</li>
                  <li>• Barometric pressure anomalies</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-300 mb-1">Syndicate Defense:</p>
                <ul className="space-y-0.5">
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
            <h2 className="text-lg font-bold text-white">📊 Analytics Dashboard</h2>
            <button onClick={fetchAnalytics} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading.analytics ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {analytics ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: 'Total Workers', v: analytics.workers?.total || 0, sub: `${analytics.workers?.active || 0} active`, c: 'text-blue-400', bg: 'from-blue-900/20' },
                  { l: 'Premium Revenue', v: `₹${analytics.financials?.totalPremiumRevenue || 0}`, sub: `${analytics.workers?.subscribed || 0} subscribed`, c: 'text-green-400', bg: 'from-green-900/20' },
                  { l: 'Total Payouts', v: `₹${analytics.financials?.totalPayouts || 0}`, sub: `${analytics.claims?.paid || 0} claims paid`, c: 'text-purple-400', bg: 'from-purple-900/20' },
                  { l: 'Pool Balance', v: `₹${Math.max(0, analytics.financials?.poolBalance || 0)}`, sub: 'Liquidity Pool', c: 'text-cyan-400', bg: 'from-cyan-900/20' },
                ].map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className={`bg-gradient-to-br ${m.bg} to-slate-800/20 border border-slate-700/50 rounded-xl p-4`}>
                    <p className={`text-2xl font-bold ${m.c}`}>{m.v}</p>
                    <p className="text-sm text-white mt-1">{m.l}</p>
                    <p className="text-xs text-slate-500">{m.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Claims & Fraud */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white mb-3">📋 Claims Breakdown</h3>
                  <div className="space-y-2">
                    {[
                      { l: 'Paid', v: analytics.claims?.paid || 0, c: 'bg-green-500' },
                      { l: 'Pending', v: analytics.claims?.pending || 0, c: 'bg-blue-500' },
                      { l: 'Micro-Verify', v: analytics.claims?.microVerify || 0, c: 'bg-yellow-500' },
                      { l: 'Rejected', v: analytics.claims?.rejected || 0, c: 'bg-red-500' },
                    ].map((item, i) => {
                      const total = analytics.claims?.total || 1;
                      const pct = Math.round((item.v / total) * 100) || 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-20">{item.l}</span>
                          <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.1 }}
                              className={`h-full ${item.c} rounded-full`} />
                          </div>
                          <span className="text-xs text-white font-bold w-8 text-right">{item.v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white mb-3">🛡️ Fraud Metrics</h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className={`text-2xl font-bold ${(analytics.fraud?.avgFraudScore || 0) > 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {analytics.fraud?.avgFraudScore || 0}
                      </p>
                      <p className="text-xs text-slate-400">Avg Score</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-red-400">{analytics.fraud?.flagged || 0}</p>
                      <p className="text-xs text-slate-400">Flagged</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-blue-400">{analytics.fraud?.detectionRate || '0%'}</p>
                      <p className="text-xs text-slate-400">Detection Rate</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <p className="text-2xl font-bold text-purple-400">{analytics.disruptions?.total || 0}</p>
                      <p className="text-xs text-slate-400">Disruptions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liquidity Pool */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-700/30 rounded-xl p-5">
                <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" /> Community Liquidity Pool
                </h3>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-cyan-400">₹{Math.max(0, analytics.financials?.poolBalance || 0)}</p>
                    <p className="text-xs text-slate-400">Pool Balance</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">₹{analytics.financials?.totalPremiumRevenue || 0}</p>
                    <p className="text-xs text-slate-400">Total Contributions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">₹{analytics.financials?.totalPayouts || 0}</p>
                    <p className="text-xs text-slate-400">Total Payouts</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${(analytics.financials?.netMargin || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(analytics.financials?.netMargin || 0) >= 0 ? '+' : ''}₹{analytics.financials?.netMargin || 0}
                    </p>
                    <p className="text-xs text-slate-400">Net Margin</p>
                  </div>
                </div>
              </motion.div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">Loading analytics...</div>
          )}
        </div>
      )}
    </div>
  );
}
