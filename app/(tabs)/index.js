import { View, Text, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useQoE } from '../../src/context/QoEContext';

export default function DashboardScreen() {
  const { scores, metrics } = useQoE();

  // Debug logging
  useEffect(() => {
    console.log('[Dashboard] Scores updated:', {
      overall: scores.overall.score,
      voice: scores.voice.score,
      data: scores.data.score,
      voiceAppliedWeight: scores.voice.appliedWeight,
      dataAppliedWeight: scores.data.appliedWeight,
    });
  }, [scores]);

  const formatScore = (value) => {
    if (value === null || value === undefined) return '--';
    return `${Math.round(value * 100)}%`;
  };

  const scoreCards = [
    { label: 'Overall QoE', value: formatScore(scores.overall.score) },
    { label: 'Voice Score', value: formatScore(scores.voice.score) },
    { label: 'Data Score', value: formatScore(scores.data.score) },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crowdsourcing QoE</Text>
      <Text style={styles.subtitle}>
        End-to-end scoring using ETSI TR 103 559 weightings. Populate metrics
        via the Voice/Data tabs to see updates in real time.
      </Text>

      <View style={styles.cardsRow}>
        {scoreCards.map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.breakdown}>
        <Text style={styles.sectionTitle}>Coverage</Text>
        <Text style={styles.sectionText}>
          Voice data coverage:{' '}
          {formatScore(scores.voice.appliedWeight)}
        </Text>
        <Text style={styles.sectionText}>
          Data sub-metrics coverage:{' '}
          {formatScore(scores.data.appliedWeight)}
        </Text>
      </View>
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
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#111b2c',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  cardLabel: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 8,
  },
  cardValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  breakdown: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 6,
  },
});


