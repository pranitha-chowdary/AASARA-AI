import { motion } from 'framer-motion';
import { AasaraLogo } from './AasaraLogo';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        <AasaraLogo size="xl" animated={true} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-blue-500 mb-2">Aasara AI</h1>
          <p className="text-slate-400 text-sm">Your Safety Net</p>
        </motion.div>
      </div>
    </div>
  );
}
