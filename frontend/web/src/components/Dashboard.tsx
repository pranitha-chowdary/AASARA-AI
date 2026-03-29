import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { OnboardingStep1 } from './OnboardingStep1';
import { OnboardingStep2 } from './OnboardingStep2';
import { RealTimeDashboard } from './RealTimeDashboard';
import { AdminDashboard } from './AdminDashboard';
import { AasaraLogo } from './AasaraLogo';

export function Dashboard() {
  const { user, signOut, userType } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // If admin, skip onboarding checks
      if (userType === 'admin') {
        setLoading(false);
        return;
      }
      
      checkOnboardingAndSubscription();
    }
  }, [user, userType]);

  const checkOnboardingAndSubscription = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      // Try to fetch subscription from database
      const subResponse = await fetch('http://localhost:5001/api/subscription/get-active', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (subResponse.ok) {
        // User has active subscription - go to dashboard
        setCurrentStep(3);
      } else if (subResponse.status === 404) {
        // No subscription yet - check if onboarding started
        const step = (user as any).onboardingStep || 1;
        setCurrentStep(step >= 3 ? 3 : step);
      } else if ((user as any).onboardingCompleted) {
        // Fallback: check if user object says onboarding is complete
        setCurrentStep(3);
      } else {
        // New user or incomplete onboarding
        const step = (user as any).onboardingStep || 1;
        setCurrentStep(step);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      // Fallback to onboarding step from user object
      const step = (user as any).onboardingStep || 1;
      const completed = (user as any).onboardingCompleted;
      setCurrentStep(completed ? 3 : step);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Admin Dashboard - Show this if user is admin
  if (userType === 'admin' && !loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AasaraLogo size="md" />
              <div>
                <div className="text-teal-600 font-semibold">AASARA ADMIN CONTROL</div>
                <div className="text-xs text-slate-500">Gig Worker Protection Management</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>
        
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <AdminDashboard />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-teal-600">Loading...</div>
      </div>
    );
  }

  // Step 1: Platform Linking
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AasaraLogo size="md" />
              <div>
                <div className="text-teal-600 font-semibold">Platform Linking</div>
                <div className="text-xs text-slate-500">Step 1 of 3</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>
        
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <OnboardingStep1 
            onComplete={() => setCurrentStep(2)}
          />
        </div>
      </div>
    );
  }

  // Step 2: Plan Selection & Payment
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AasaraLogo size="md" />
              <div>
                <div className="text-teal-600 font-semibold">Weekly Plan & Payment</div>
                <div className="text-xs text-slate-500">Step 2 of 3</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>
        
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <OnboardingStep2 
            onComplete={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        </div>
      </div>
    );
  }

  // Step 3: Active Dashboard
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AasaraLogo size="md" />
              <div>
                <div className="text-teal-600 font-semibold">Welcome, {user?.fullName}</div>
                <div className="text-xs text-slate-500">Your protection plan is active</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>
        
        <div className="px-4 sm:px-6 lg:px-8 py-0">
          {/* Real-Time Dashboard */}
          <RealTimeDashboard />
        </div>
      </div>
    );
  }

  return null;
}
