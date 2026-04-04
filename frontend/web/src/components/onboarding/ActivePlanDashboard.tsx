import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Shield, AlertCircle, TrendingUp, LogOut, Clock, CheckCircle } from 'lucide-react';

interface ActivePlanDashboardProps {
  user: any;
  onboardingStatus: any;
  onLogout: () => void;
}

export function ActivePlanDashboard({ user, onboardingStatus, onLogout }: ActivePlanDashboardProps) {
  const [subscription, setSubscription] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const token = localStorage.getItem('authToken');

      // Fetch active subscription
      const subResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/subscription/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData);
      }

      // Fetch calendar events
      const calResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/subscription/calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (calResponse.ok) {
        const calData = await calResponse.json();
        setCalendarEvents(calData.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-blue-400">Loading...</div>
      </div>
    );
  }

  const weekStart = subscription ? new Date(subscription.weekStartDate) : new Date();
  const weekEnd = subscription ? new Date(subscription.weekEndDate) : new Date();

  // Generate calendar days
  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    daysOfWeek.push(date);
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-500">Welcome, {user?.fullName}!</h1>
            <p className="text-slate-400 text-sm mt-1">Your protection plan is active</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Plan Status */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-lg border border-green-700 p-6 shadow-lg shadow-green-900/20">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-white">Plan Active</h3>
            </div>
            <p className="text-slate-400 text-sm mb-3">Your weekly protection is enabled</p>
            <div className="text-2xl font-bold text-green-400">₹{subscription?.premiumAmount} Paid</div>
          </motion.div>

          {/* Platform */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Platform</h3>
            </div>
            <p className="text-slate-400 text-sm mb-3">Linked account</p>
            <div className="text-2xl font-bold text-blue-400 capitalize">{subscription?.linkedPlatform}</div>
          </motion.div>

          {/* Risk Tier */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-white">Risk Tier</h3>
            </div>
            <p className="text-slate-400 text-sm mb-3">This week's assessment</p>
            <div className="text-2xl font-bold text-orange-400">{subscription?.riskTier}</div>
          </motion.div>
        </div>

        {/* Calendar with Events */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            This Week's Calendar
          </h2>

          {/* Calendar Grid */}
          <div className="mb-8">
            <div className="grid grid-cols-7 gap-4">
              {daysOfWeek.map((date, idx) => {
                const dayEvents = calendarEvents.filter((e) => e.date === date.toISOString().split('T')[0]);
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

                return (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      dayEvents.length > 0
                        ? 'bg-red-900/20 border-red-700 shadow-lg shadow-red-900/30'
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xs font-semibold text-slate-300 mb-2">{dayOfWeek.slice(0, 3)}</div>
                      <div className="text-2xl font-bold text-white mb-3">{date.getDate()}</div>

                      {dayEvents.length > 0 && (
                        <div className="space-y-2">
                          {dayEvents.map((event, eventIdx) => (
                            <div key={eventIdx} className="text-xs bg-red-950/50 rounded px-2 py-1 border border-red-800">
                              <p className="font-semibold text-red-300">{event.type.toUpperCase()}</p>
                              <p className="text-red-200">₹{event.payout}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Events Summary */}
          {calendarEvents.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700">
              <h3 className="font-semibold text-white mb-4">Disruption Alerts</h3>
              <div className="space-y-3">
                {calendarEvents.map((event, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-white">{event.title}</p>
                      <p className="text-slate-400 text-sm">
                        {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">₹{event.payout}</p>
                      <p className="text-xs text-slate-400">Auto payout</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {calendarEvents.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
              <p className="text-slate-400">No disruptions detected for this week</p>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8">
          <h2 className="text-xl font-bold text-white mb-6">What's Next?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-white">Go Online</h3>
              </div>
              <p className="text-slate-400 text-sm">Start your shift and earn with protection</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-white">Monitor Events</h3>
              </div>
              <p className="text-slate-400 text-sm">Check calendar daily for any disruptions</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-white">Next Week</h3>
              </div>
              <p className="text-slate-400 text-sm">Auto-renewal with updated risk pricing</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
