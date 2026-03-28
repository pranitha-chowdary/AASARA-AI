import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

interface Worker {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
}

type DisruptionType = 'monsoon' | 'heatwave' | 'curfew' | 'pollution' | 'strike';

const AdminDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedDisruption, setSelectedDisruption] = useState<DisruptionType>('monsoon');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const disruptions: DisruptionType[] = ['monsoon', 'heatwave', 'curfew', 'pollution', 'strike'];

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const workerList = await apiService.getAllWorkers();
      setWorkers(workerList);
      if (workerList.length > 0) {
        setSelectedWorkerId(workerList[0].id);
      }
    } catch (error) {
      console.error('Failed to load workers:', error);
      Alert.alert('Error', 'Failed to load workers list');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDisruption = async () => {
    if (!selectedWorkerId) {
      Alert.alert('Error', 'Please select a worker');
      return;
    }

    Alert.alert(
      'Confirm Disruption',
      `Trigger ${selectedDisruption} for selected worker?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger',
          onPress: async () => {
            try {
              setTriggering(true);
              await apiService.triggerDisruption(selectedWorkerId, selectedDisruption, 'high');
              Alert.alert('Success', 'Disruption triggered successfully', [
                { text: 'OK', onPress: loadWorkers },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.message || 'Failed to trigger disruption');
            } finally {
              setTriggering(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
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

  const getDisruptionColor = (type: DisruptionType) => {
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

  const getDisruptionIcon = (type: DisruptionType) => {
    switch (type) {
      case 'monsoon':
        return '🌧️';
      case 'heatwave':
        return '🔥';
      case 'curfew':
        return '🚫';
      case 'pollution':
        return '💨';
      case 'strike':
        return '✊';
      default:
        return '⚠️';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Loading workers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Admin Control</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Worker Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Worker</Text>
          <Text style={styles.cardDescription}>
            {workers.length} worker{workers.length !== 1 ? 's' : ''} available
          </Text>

          {workers.length > 0 ? (
            <View style={styles.workerGrid}>
              {workers.map((worker) => (
                <TouchableOpacity
                  key={worker.id}
                  style={[
                    styles.workerCard,
                    selectedWorkerId === worker.id && styles.workerCardSelected,
                  ]}
                  onPress={() => setSelectedWorkerId(worker.id)}
                >
                  <Text style={styles.workerName}>{worker.fullName}</Text>
                  <Text style={styles.workerEmail}>{worker.email}</Text>
                  {worker.phoneNumber && <Text style={styles.workerPhone}>{worker.phoneNumber}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No workers found</Text>
            </View>
          )}
        </View>

        {/* Disruption Type Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Disruption Type</Text>
          <View style={styles.disruptionGrid}>
            {disruptions.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.disruptionButton,
                  selectedDisruption === type && styles.disruptionButtonActive,
                  { borderColor: getDisruptionColor(type) },
                ]}
                onPress={() => setSelectedDisruption(type)}
              >
                <Text style={styles.disruptionIcon}>{getDisruptionIcon(type)}</Text>
                <Text
                  style={[
                    styles.disruptionLabel,
                    selectedDisruption === type && {
                      color: getDisruptionColor(type),
                      fontWeight: '600',
                    },
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary Card */}
        {selectedWorker && (
          <View style={[styles.card, styles.summaryCard]}>
            <Text style={styles.cardTitle}>Ready to Trigger</Text>
            <View style={styles.summaryContent}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Worker:</Text>
                <Text style={styles.summaryValue}>{selectedWorker.fullName}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Disruption:</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: getDisruptionColor(selectedDisruption) },
                  ]}
                >
                  {getDisruptionIcon(selectedDisruption)} {selectedDisruption}
                </Text>
              </View>
            </View>

            {/* Trigger Button */}
            <TouchableOpacity
              style={[styles.triggerButton, triggering && styles.triggerButtonDisabled]}
              onPress={handleTriggerDisruption}
              disabled={triggering || !selectedWorkerId}
            >
              {triggering ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.triggerButtonText}>🚨 Trigger Disruption</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>⚠️ Admin Responsibilities</Text>
          <Text style={styles.infoText}>
            Triggering a disruption will immediately alert the selected worker about hazardous conditions
            on their route.
          </Text>
          <Text style={styles.infoText}>Use this power responsibly to protect worker safety.</Text>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
  },
  workerGrid: {
    gap: 12,
  },
  workerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  workerCardSelected: {
    borderColor: '#f97316',
    backgroundColor: '#f9731622',
  },
  workerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  workerEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  workerPhone: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  disruptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  disruptionButton: {
    flex: 0.48,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  disruptionButtonActive: {
    backgroundColor: '#334155',
    borderWidth: 2,
  },
  disruptionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  disruptionLabel: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  summaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  summaryContent: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  triggerButton: {
    backgroundColor: '#f97316',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  triggerButtonDisabled: {
    opacity: 0.5,
  },
  triggerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
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
    color: '#f97316',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
});

export default AdminDashboardScreen;
