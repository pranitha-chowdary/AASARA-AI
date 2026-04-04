import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, ImageBackground, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import WorkerDashboardScreen from '../screens/WorkerDashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import OnboardingStep1Screen from '../screens/OnboardingStep1Screen';
import OnboardingStep2Screen from '../screens/OnboardingStep2Screen';

const Stack = createNativeStackNavigator();

const WorkerFlow: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [localStep, setLocalStep] = useState<number | null>(null);

  const step = localStep ?? (user as any)?.onboardingStep ?? 3;
  const completed = (user as any)?.onboardingCompleted ?? false;

  if (!completed && step === 1) {
    return (
      <OnboardingStep1Screen
        onComplete={async () => {
          await refreshUser();
          setLocalStep(2);
        }}
      />
    );
  }

  if (!completed && step === 2) {
    return (
      <OnboardingStep2Screen
        onBack={() => setLocalStep(1)}
        onComplete={async () => {
          await refreshUser();
          setLocalStep(null);
        }}
      />
    );
  }

  return <WorkerDashboardScreen />;
};

const AppNavigator: React.FC = () => {
  const { isWorker, isAdmin } = useAuth();

  if (isWorker) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="WorkerFlow" component={WorkerFlow} />
      </Stack.Navigator>
    );
  }

  if (isAdmin) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      </Stack.Navigator>
    );
  }

  return null;
};

const RootNavigator: React.FC = () => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <ImageBackground source={require('../../assets/bg-hero.jpeg')} style={styles.bg} resizeMode="cover">
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'default' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' },
});

export default RootNavigator;
