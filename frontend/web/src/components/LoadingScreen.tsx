import { motion } from 'framer-motion';
import { AasaraLogo } from './AasaraLogo';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'linear-gradient(160deg, rgba(15,30,90,0.97) 0%, rgba(29,51,130,0.95) 100%)' }}>
      <div className="flex flex-col items-center gap-6">
        <AasaraLogo size="xl" animated={true} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-white mb-2">Aasara AI</h1>
          <p className="text-blue-200/80 text-sm">Your Safety Net</p>
        </motion.div>
      </div>
    </div>
  );
}
