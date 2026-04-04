import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoadingScreen } from './components/LoadingScreen';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { ResetPassword } from './components/ResetPassword';

function AppContent() {
  const { user, loading } = useAuth();
  const [initialized, setInitialized] = useState(false);

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

  if (!user) {
    return <AuthView />;
  }

  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
