import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useState, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useQoE } from '../src/context/QoEContext';

export default function SettingsScreen() {
  const { metrics, scores, history, resetMetrics, clearHistory } = useQoE();
  const [autoSave, setAutoSave] = useState(false);

  const exportToJSON = async () => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        currentMetrics: metrics,
        currentScores: scores,
        history: history,
      };

      const fileName = `qoe-export-${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export QoE Data',
        });
        Alert.alert('Success', 'Data exported successfully!');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('[Settings] Export error:', error);
      Alert.alert('Error', 'Failed to export data: ' + error.message);
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = 'Timestamp,Overall Score,Voice Score,Data Score,Voice Attempts,Voice Completed,Voice Dropped,Browsing Requests,Browsing Completed,Streaming Requests,Streaming Completed,HTTP DL Requests,HTTP DL Completed,HTTP UL Requests,HTTP UL Completed,Social Requests,Social Completed\n';
      
      // Add current metrics
      const now = new Date().toISOString();
      csv += `${now},${scores.overall?.score || ''},${scores.voice?.score || ''},${scores.data?.score || ''},`;
      csv += `${metrics.voice.attempts},${metrics.voice.completed},${metrics.voice.dropped},`;
      csv += `${metrics.data.browsing.requests},${metrics.data.browsing.completed},`;
      csv += `${metrics.data.streaming.requests},${metrics.data.streaming.completed},`;
      csv += `${metrics.data.http.dl.requests},${metrics.data.http.dl.completed},`;
      csv += `${metrics.data.http.ul.requests},${metrics.data.http.ul.completed},`;
      csv += `${metrics.data.social.requests},${metrics.data.social.completed}\n`;

      // Add history entries
      history.forEach((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        csv += `${timestamp},${entry.scores.overall?.score || ''},${entry.scores.voice?.score || ''},${entry.scores.data?.score || ''},`;
        csv += `${entry.metrics.voice.attempts},${entry.metrics.voice.completed},${entry.metrics.voice.dropped},`;
        csv += `${entry.metrics.data.browsing.requests},${entry.metrics.data.browsing.completed},`;
        csv += `${entry.metrics.data.streaming.requests},${entry.metrics.data.streaming.completed},`;
        csv += `${entry.metrics.data.http.dl.requests},${entry.metrics.data.http.dl.completed},`;
        csv += `${entry.metrics.data.http.ul.requests},${entry.metrics.data.http.ul.completed},`;
        csv += `${entry.metrics.data.social.requests},${entry.metrics.data.social.completed}\n`;
      });

      const fileName = `qoe-export-${Date.now()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export QoE Data',
        });
        Alert.alert('Success', 'Data exported to CSV successfully!');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('[Settings] CSV export error:', error);
      Alert.alert('Error', 'Failed to export CSV: ' + error.message);
    }
  };

  const handleResetMetrics = () => {
    Alert.alert(
      'Reset Metrics',
      'Are you sure you want to reset all current metrics? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetMetrics();
            Alert.alert('Success', 'Metrics reset successfully!');
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all history entries? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            Alert.alert('Success', 'History cleared successfully!');
          },
        },
      ]
    );
  };

  const SettingItem = ({ title, description, onPress, rightComponent, danger = false }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingItemContent}>
        <Text style={[styles.settingItemTitle, danger && styles.settingItemTitleDanger]}>
          {title}
        </Text>
        {description && (
          <Text style={styles.settingItemDescription}>{description}</Text>
        )}
      </View>
      {rightComponent && <View style={styles.settingItemRight}>{rightComponent}</View>}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Configure app settings, export data, and manage your QoE measurements.
      </Text>

      {/* Data Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Export</Text>
        <SettingItem
          title="Export to JSON"
          description="Export all QoE data including current metrics and history"
          onPress={exportToJSON}
        />
        <SettingItem
          title="Export to CSV"
          description="Export QoE data in CSV format for spreadsheet analysis"
          onPress={exportToCSV}
        />
      </View>

      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <SettingItem
          title="Reset Current Metrics"
          description="Clear all current QoE measurements (history will be preserved)"
          onPress={handleResetMetrics}
          danger={true}
        />
        <SettingItem
          title="Clear History"
          description={`Delete all ${history.length} saved history entries`}
          onPress={handleClearHistory}
          danger={true}
        />
      </View>

      {/* Statistics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>History Entries</Text>
            <Text style={styles.statValue}>{history.length}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Voice Attempts</Text>
            <Text style={styles.statValue}>{metrics.voice.attempts}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Data Tests</Text>
            <Text style={styles.statValue}>
              {metrics.data.browsing.requests +
                metrics.data.streaming.requests +
                metrics.data.http.dl.requests +
                metrics.data.http.ul.requests +
                metrics.data.social.requests}
            </Text>
          </View>
        </View>
      </View>

      {/* App Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <SettingItem
          title="Version"
          description="1.0.0"
          onPress={null}
        />
        <SettingItem
          title="Scoring Standard"
          description="ETSI TR 103 559"
          onPress={null}
        />
        <SettingItem
          title="About"
          description="Crowdsourcing QoE Measurement App"
          onPress={null}
        />
    </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  settingItem: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1f2a44',
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemContent: {
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  settingItemTitleDanger: {
    color: '#ef4444',
  },
  settingItemDescription: {
    fontSize: 12,
    color: '#9ca3af',
  },
  settingItemRight: {
    marginLeft: 12,
  },
  statsContainer: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a44',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
