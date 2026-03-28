import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import WorkerDashboardScreen from '../screens/WorkerDashboardScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Simple Tab Icons using text
const TabIcon = ({ focused, icon, label }: any) => (
  <View style={{ alignItems: 'center', gap: 4 }}>
    <Text style={{ fontSize: 20 }}>{icon}</Text>
    <Text
      style={{
        fontSize: 10,
        color: focused ? '#10b981' : '#64748b',
      }}
    >
      {label}
    </Text>
  </View>
);

const AppNavigator: React.FC = () => {
  const { isWorker, isAdmin } = useAuth();

  if (isWorker) {
    // Worker has single dashboard (can be expanded to tab navigator)
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
        }}
      >
        <Stack.Screen name="WorkerDashboard" component={WorkerDashboardScreen} />
      </Stack.Navigator>
    );
  }

  if (isAdmin) {
    // Admin has single dashboard (can be expanded to tab navigator)
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
        }}
      >
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      </Stack.Navigator>
    );
  }

  return null;
};

const RootNavigator: React.FC = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'default',
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="App" component={AppNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
