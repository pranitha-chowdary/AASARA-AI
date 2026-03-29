import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Utensils, ShoppingBag, Package, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const platforms = [
  { id: 'zomato', name: 'Zomato', icon: Utensils, color: 'from-red-600 to-red-700' },
  { id: 'swiggy', name: 'Swiggy', icon: Utensils, color: 'from-orange-600 to-orange-700' },
  { id: 'dunzo', name: 'Dunzo', icon: ShoppingBag, color: 'from-purple-600 to-purple-700' },
  { id: 'other', name: 'Other Platform', icon: Package, color: 'from-slate-600 to-slate-700' },
];

interface OnboardingStep1Props {
  onComplete: () => void;
}

export function OnboardingStep1({ onComplete }: OnboardingStep1Props) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [platformCode, setPlatformCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  // Load previously selected platform if user returns to Step 1
  useEffect(() => {
    // Check from user's onboarding data in database via /api/auth/me
    // For now, just reset since backend doesn't return it yet
    // In a real app, fetch from database to show previously selected platform
  }, [user?.id]);

  const handleLinkPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform || !user) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5001/api/onboarding/link-platform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: selectedPlatform,
          platformCode: platformCode || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link platform');
      }

      const data = await response.json();
      console.log('Platform linked:', data);
      
      // Backend automatically updates onboarding step in MongoDB
      // No need to save to localStorage - always use database as source of truth
      setSuccess(true);

      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to link platform');
      console.error('Platform linking error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-lg p-6 text-white shadow-sm"
      >
        <h2 className="text-2xl font-bold mb-2">Welcome, {user?.fullName}!</h2>
        <p className="text-teal-50">
          Let's set up your protection plan. Start by linking your delivery platform.
        </p>
      </motion.div>

      {/* Step Progress */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex-1 bg-teal-600 h-2 rounded-full"></div>
        <div className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold shadow-sm">
          1
        </div>
        <div className="flex-1 bg-slate-200 h-2 rounded-full mx-2"></div>
        <div className="w-8 h-8 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center font-bold">
          2
        </div>
      </div>

      {/* Title */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Link Your Delivery Platform</h3>
        <p className="text-slate-600">
          Connect your delivery account to enable real-time monitoring and automatic payouts.
        </p>
      </div>

      {/* Platform Selection */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {platforms.map((platform) => {
          const Icon = platform.icon;
          const isSelected = selectedPlatform === platform.id;
          return (
            <motion.button
              key={platform.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedPlatform(platform.id)}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? `border-teal-500 bg-gradient-to-br ${platform.color} shadow-md`
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}
            >
              <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
              <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                {platform.name}
              </p>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <CheckCircle2 className="w-5 h-5 text-white drop-shadow-sm" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Platform Code Input */}
      {selectedPlatform && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <label className="block text-sm font-medium text-slate-700">
            Platform Code/ID (Optional)
          </label>
          <input
            type="text"
            value={platformCode}
            onChange={(e) => setPlatformCode(e.target.value)}
            placeholder={`Enter your ${selectedPlatform} partner ID`}
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm"
          />
          <p className="text-xs text-slate-500">
            You can find this in your partner app settings or leave blank if unsure
          </p>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Success Message */}
      {success && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5" />
          <div>
            <p className="font-medium">Platform Linked Successfully!</p>
            <p className="text-sm opacity-90">Proceeding to payment setup...</p>
          </div>
        </motion.div>
      )}

      {/* Continue Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleLinkPlatform}
        disabled={!selectedPlatform || loading || success}
        className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-sm ${
          !selectedPlatform || loading || success
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-teal-600 hover:bg-teal-700 text-white'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Linking Platform...
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Platform Linked
          </>
        ) : (
          'Continue to Payment'
        )}
      </motion.button>

      {/* Info Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-slate-700">Why link your platform?</p>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>✓ Real-time delivery status tracking</li>
          <li>✓ Automatic claim triggering for disruptions</li>
          <li>✓ Verify your earnings and disruption impact</li>
        </ul>
      </div>
    </div>
  );
}
