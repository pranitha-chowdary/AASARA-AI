import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useDisruption } from '../contexts/DisruptionContext';
import { apiService } from '../services/api';

interface Subscription {
  id: string;
  planType: 'free' | 'premium' | 'enterprise';
  weeklyCount: number;
  monthlyCount: number;
}

const WorkerDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeDisruption, loading: disruptionLoading } = useDisruption();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [shiftActive, setShiftActive] = useState(true); // In-app state

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const sub = await apiService.getActiveSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await logout();
        },
        style: 'destructive',
      },
    ]);
  };

  const getDisruptionColor = (type?: string) => {
    switch (type) {
      case 'monsoon':
        return '#3b82f6';
      case 'heatwave':
        return '#ef4444';
      case 'curfew':
        return '#8b5cf6';
      case 'pollution':
        return '#d97706';
      case 'strike':
        return '#ec4899';
      default:
        return '#6b7280';
    }
  };

  const getDisruptionDisplay = () => {
    if (!activeDisruption) {
      return {
        title: 'No Active Disruptions',
        description: 'Your route is clear',
        color: '#10b981',
        icon: '✓',
      };
    }

    return {
      title: activeDisruption.disruptionType.toUpperCase(),
      description: `Severity: ${activeDisruption.severity}`,
      color: getDisruptionColor(activeDisruption.disruptionType),
      icon: '⚠',
    };
  };

  const disruption = getDisruptionDisplay();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Welcome, {user?.fullName || 'Worker'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Shift Status Card */}
        <View style={[styles.card, styles.shiftCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Shift Status</Text>
            <View style={[styles.badge, shiftActive ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={styles.badgeText}>{shiftActive ? 'ACTIVE' : 'INACTIVE'}</Text>
            </View>
          </View>
          <Text style={styles.shiftStatus}>
            {shiftActive ? '🟢 You are currently working' : '🔴 Shift not active'}
          </Text>
          <TouchableOpacity
            style={[styles.shiftButton, shiftActive ? styles.shiftStop : styles.shiftStart]}
            onPress={() => setShiftActive(!shiftActive)}
          >
            <Text style={styles.shiftButtonText}>{shiftActive ? 'End Shift' : 'Start Shift'}</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Premium Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Premium</Text>
          <View style={styles.premiumContent}>
            <View style={styles.premiumItem}>
              <Text style={styles.premiumLabel}>Plan</Text>
              <Text style={styles.premiumValue}>{subscription?.planType || 'free'}</Text>
            </View>
            <View style={styles.premiumItem}>
              <Text style={styles.premiumLabel}>This Week</Text>
              <Text style={styles.premiumValue}>{subscription?.weeklyCount || 0}</Text>
            </View>
            <View style={styles.premiumItem}>
              <Text style={styles.premiumLabel}>This Month</Text>
              <Text style={styles.premiumValue}>{subscription?.monthlyCount || 0}</Text>
            </View>
          </View>
        </View>

        {/* Active Disruption Alert Card */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: disruption.color }]}>
          <View style={styles.disruptionHeader}>
            <Text style={{ fontSize: 24 }}>{disruption.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: disruption.color }]}>
                {disruption.title}
              </Text>
              <Text style={styles.disruptionDescription}>{disruption.description}</Text>
            </View>
          </View>

          {activeDisruption && (
            <View style={styles.disruptionDetails}>
              <Text style={styles.detailText}>
                Triggered at: {new Date(activeDisruption.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={styles.detailText}>Severity: {activeDisruption.severity}</Text>
            </View>
          )}

          {disruptionLoading && (
            <View style={styles.pollingIndicator}>
              <ActivityIndicator size="small" color={disruption.color} />
              <Text style={styles.pollingText}>Checking for updates...</Text>
            </View>
          )}
        </View>

        {/* Info Footer */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Real-Time Alerts</Text>
          <Text style={styles.infoText}>
            Your dashboard updates every 5 seconds to show active disruptions affecting your route.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#cbd5e1',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shiftCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeActive: {
    backgroundColor: '#10b98133',
  },
  badgeInactive: {
    backgroundColor: '#ef444433',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  shiftStatus: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 12,
  },
  shiftButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shiftStart: {
    backgroundColor: '#10b981',
  },
  shiftStop: {
    backgroundColor: '#ef4444',
  },
  shiftButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  premiumContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  premiumItem: {
    alignItems: 'center',
  },
  premiumLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  premiumValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f59e0b',
  },
  disruptionHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  disruptionDescription: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 2,
  },
  disruptionDetails: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  pollingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  pollingText: {
    fontSize: 12,
    color: '#64748b',
  },
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
});

export default WorkerDashboardScreen;
