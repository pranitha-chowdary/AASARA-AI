import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface PlatformLinkingProps {
  userId: string;
  onSuccess: () => void;
}

const PLATFORMS = [
  { id: 'zomato', name: 'Zomato', color: 'from-red-600 to-red-700', logo: '🍕' },
  { id: 'swiggy', name: 'Swiggy', color: 'from-orange-600 to-orange-700', logo: '🛵' },
  { id: 'dunzo', name: 'Dunzo', color: 'from-yellow-600 to-yellow-700', logo: '📦' },
];

export function PlatformLinking({ userId, onSuccess }: PlatformLinkingProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLinkPlatform = async () => {
    if (!selectedPlatform) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:5001/api/onboarding/${userId}/link-platform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform: selectedPlatform,
          platformCode: `${selectedPlatform}_${Date.now()}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to link platform');
      }

      const data = await response.json();
      console.log('Platform linked:', data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to link platform');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 rounded-lg border border-slate-800 p-8">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-white mb-2">Step 1: Link Your Platform</h2>
        <p className="text-slate-400 mb-8">
          Connect your delivery platform account to start earning protection instantly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PLATFORMS.map((platform) => (
            <motion.button
              key={platform.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlatform(platform.id)}
              className={`relative p-8 rounded-lg border-2 transition-all ${
                selectedPlatform === platform.id
                  ? `bg-gradient-to-br ${platform.color} border-white/30`
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="text-5xl mb-4">{platform.logo}</div>
              <h3 className={`text-xl font-bold mb-2 ${selectedPlatform === platform.id ? 'text-white' : 'text-slate-200'}`}>
                {platform.name}
              </h3>
              <p className={`text-sm ${selectedPlatform === platform.id ? 'text-white/80' : 'text-slate-400'}`}>
                {selectedPlatform === platform.id ? '✓ Selected' : 'Tap to select'}
              </p>

              {selectedPlatform === platform.id && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-600" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        {error && <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">{error}</div>}

        <button
          onClick={handleLinkPlatform}
          disabled={!selectedPlatform || loading}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
        >
          {loading ? 'Linking...' : 'Link Platform & Proceed'}
        </button>

        <p className="text-slate-400 text-center text-sm mt-6">
          We'll securely connect to your {selectedPlatform || 'selected'} account to verify your earnings and calculate your protection premium.
        </p>
      </div>
    </motion.div>
  );
}
