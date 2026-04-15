import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { ResetPassword } from './components/ResetPassword';
import { LandingPage } from './components/LandingPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    if (!loading) {
      setInitialized(true);
    }
  }, [loading]);

  if (window.location.pathname.startsWith('/reset-password/')) {
    return <ResetPassword />;
  }

  if (!initialized) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Dashboard />;
  }

  if (showLanding) {
    return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  return <AuthView />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
