import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import { useQoE } from '../../src/context/QoEContext';

export default function HistoryScreen() {
  const { metrics, scores, history, saveHistoryEntry, clearHistory } = useQoE();
  const [selectedEntry, setSelectedEntry] = useState(null);

  const formatScore = (value) => {
    if (value === null || value === undefined) return '--';
    return `${Math.round(value * 100)}%`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleSaveSnapshot = () => {
    Alert.alert(
      'Save Snapshot',
      'Save current QoE metrics as a history entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            await saveHistoryEntry(metrics, scores);
            Alert.alert('Success', 'Snapshot saved successfully!');
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to delete all history entries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setSelectedEntry(null);
            Alert.alert('Success', 'History cleared!');
          },
        },
      ]
    );
  };

  const renderHistoryEntry = ({ item }) => {
    const isSelected = selectedEntry?.timestamp === item.timestamp;
    return (
      <TouchableOpacity
        style={[styles.historyItem, isSelected && styles.historyItemSelected]}
        onPress={() => setSelectedEntry(isSelected ? null : item)}
      >
        <View style={styles.historyItemHeader}>
          <Text style={styles.historyItemTime}>{formatTime(item.timestamp)}</Text>
          <Text style={styles.historyItemScore}>
            Overall: {formatScore(item.scores.overall?.score)}
          </Text>
        </View>
        <View style={styles.historyItemMetrics}>
          <Text style={styles.historyItemMetric}>
            Voice: {formatScore(item.scores.voice?.score)}
          </Text>
          <Text style={styles.historyItemMetric}>
            Data: {formatScore(item.scores.data?.score)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEntryDetails = (entry) => {
    if (!entry) return null;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>Snapshot Details</Text>
        <Text style={styles.detailsTime}>{formatTime(entry.timestamp)}</Text>

        <View style={styles.detailsSection}>
          <Text style={styles.detailsSectionTitle}>Overall Scores</Text>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Overall QoE:</Text>
            <Text style={styles.detailsValue}>
              {formatScore(entry.scores.overall?.score)}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Voice Score:</Text>
            <Text style={styles.detailsValue}>
              {formatScore(entry.scores.voice?.score)}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Data Score:</Text>
            <Text style={styles.detailsValue}>
              {formatScore(entry.scores.data?.score)}
            </Text>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.detailsSectionTitle}>Voice Metrics</Text>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Attempts:</Text>
            <Text style={styles.detailsValue}>{entry.metrics.voice.attempts}</Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Completed:</Text>
            <Text style={styles.detailsValue}>{entry.metrics.voice.completed}</Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Dropped:</Text>
            <Text style={styles.detailsValue}>{entry.metrics.voice.dropped}</Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>CSSR:</Text>
            <Text style={styles.detailsValue}>
              {formatScore(entry.scores.voice?.cssr)}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>CDR:</Text>
            <Text style={styles.detailsValue}>
              {formatScore(entry.scores.voice?.cdr)}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Reasons Logged:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.voice.reasons?.length || 0}
            </Text>
          </View>
          {entry.metrics.voice.reasons?.length > 0 && (
            <View style={styles.reasonsList}>
              {entry.metrics.voice.reasons
                .slice(-3)
                .reverse()
                .map((reason, idx) => (
                  <Text key={idx} style={styles.reasonItem}>
                    {new Date(reason.timestamp).toLocaleTimeString()} · {reason.label || 'Unknown'} ({reason.code ?? 'n/a'})
                  </Text>
                ))}
              {entry.metrics.voice.reasons.length > 3 && (
                <Text style={styles.reasonMore}>
                  +{entry.metrics.voice.reasons.length - 3} older reason(s)
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.detailsSection}>
          <Text style={styles.detailsSectionTitle}>Data Metrics</Text>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Browsing Requests:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.data.browsing.requests}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Streaming Requests:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.data.streaming.requests}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>HTTP DL Requests:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.data.http.dl.requests}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>HTTP UL Requests:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.data.http.ul.requests}
            </Text>
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>Social Requests:</Text>
            <Text style={styles.detailsValue}>
              {entry.metrics.data.social.requests}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QoE History</Text>
      <Text style={styles.subtitle}>
        View past QoE measurements and save snapshots of current metrics.
      </Text>

      {/* Current Metrics Summary */}
      <View style={styles.currentSummary}>
        <Text style={styles.currentSummaryTitle}>Current Metrics</Text>
        <View style={styles.currentSummaryRow}>
          <Text style={styles.currentSummaryLabel}>Overall:</Text>
          <Text style={styles.currentSummaryValue}>
            {formatScore(scores.overall?.score)}
          </Text>
        </View>
        <View style={styles.currentSummaryRow}>
          <Text style={styles.currentSummaryLabel}>Voice:</Text>
          <Text style={styles.currentSummaryValue}>
            {formatScore(scores.voice?.score)}
          </Text>
        </View>
        <View style={styles.currentSummaryRow}>
          <Text style={styles.currentSummaryLabel}>Data:</Text>
          <Text style={styles.currentSummaryValue}>
            {formatScore(scores.data?.score)}
          </Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSnapshot}>
          <Text style={styles.saveButtonText}>Save Snapshot</Text>
        </TouchableOpacity>
      </View>

      {/* History List */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>
            History ({history.length} entries)
          </Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No history entries yet.{'\n'}Save a snapshot to get started.
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            renderItem={renderHistoryEntry}
            keyExtractor={(item) => item.timestamp.toString()}
            style={styles.historyList}
            contentContainerStyle={styles.historyListContent}
          />
        )}
      </View>

      {/* Selected Entry Details */}
      {selectedEntry && (
        <ScrollView style={styles.detailsScrollView}>
          {renderEntryDetails(selectedEntry)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 20,
    paddingTop: 64,
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
  currentSummary: {
    backgroundColor: '#111b2c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  currentSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  currentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  currentSummaryLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  currentSummaryValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  historySection: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  clearButton: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    paddingBottom: 16,
  },
  historyItem: {
    backgroundColor: '#0b1220',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  historyItemSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#111b2c',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyItemTime: {
    color: '#9ca3af',
    fontSize: 12,
    flex: 1,
  },
  historyItemScore: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyItemMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  historyItemMetric: {
    color: '#9ca3af',
    fontSize: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  detailsScrollView: {
    maxHeight: 300,
    marginTop: 16,
  },
  detailsContainer: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  detailsTime: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 16,
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailsLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  detailsValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  reasonsList: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  reasonItem: {
    color: '#e5e7eb',
    fontSize: 12,
    marginBottom: 2,
  },
  reasonMore: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 4,
  },
});
