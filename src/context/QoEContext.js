import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateScores } from '../utils/scoring';

const HISTORY_STORAGE_KEY = '@qoe_history';
const METRICS_STORAGE_KEY = '@qoe_metrics';
const MAX_HISTORY_ENTRIES = 100;

const createInitialMetrics = () => ({
  voice: {
    attempts: 0,
    setupOk: 0,
    completed: 0,
    dropped: 0,
    setupTimes: [],
    mosSamples: [],
    reasons: [],
  },
  data: {
    http: {
      dl: { requests: 0, completed: 0, throughputs: [] },
      ul: { requests: 0, completed: 0, throughputs: [] },
    },
    browsing: {
      requests: 0,
      completed: 0,
      durations: [],
      dnsResolutionTimes: [],
      throughputs: [],
    },
    streaming: {
      requests: 0,
      completed: 0,
      mosSamples: [],
      setupTimes: [],
      throughputs: [],
    },
    social: {
      requests: 0,
      completed: 0,
      durations: [],
      throughputs: [],
    },
  },
});

const QoEContext = createContext(null);

export const QoEProvider = ({ children }) => {
  const [metrics, setMetrics] = useState(createInitialMetrics);
  const [history, setHistory] = useState([]);

  // Load history and metrics from storage on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        // Load history
        const storedHistory = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (storedHistory) {
          setHistory(JSON.parse(storedHistory));
        }

        // Load metrics
        const storedMetrics = await AsyncStorage.getItem(METRICS_STORAGE_KEY);
        if (storedMetrics) {
          setMetrics(JSON.parse(storedMetrics));
        }
      } catch (error) {
        console.error('[QoE] Failed to load stored data:', error);
      }
    };
    loadStoredData();
  }, []);

  // Save history entry when metrics change significantly
  const saveHistoryEntry = useCallback(async (currentMetrics, currentScores) => {
    try {
      const entry = {
        timestamp: Date.now(),
        metrics: JSON.parse(JSON.stringify(currentMetrics)), // Deep copy
        scores: JSON.parse(JSON.stringify(currentScores)), // Deep copy
      };
      
      // Get current history from state, then update
      setHistory((prevHistory) => {
        const updatedHistory = [entry, ...prevHistory].slice(0, MAX_HISTORY_ENTRIES);
        // Save to storage asynchronously
        AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory)).catch(
          (error) => console.error('[QoE] Failed to save history:', error)
        );
        return updatedHistory;
      });
    } catch (error) {
      console.error('[QoE] Failed to save history:', error);
    }
  }, []);

  const resetMetrics = useCallback(async () => {
    const initial = createInitialMetrics();
    setMetrics(initial);
    // Clear persisted metrics
    try {
      await AsyncStorage.removeItem(METRICS_STORAGE_KEY);
    } catch (error) {
      console.error('[QoE] Failed to clear persisted metrics:', error);
    }
  }, []);

  const addVoiceSample = useCallback((sample) => {
    setMetrics((current) => {
      const next = { ...current, voice: { ...current.voice } };
      const {
        attempt = true,
        setupSuccessful = false,
        callCompleted = false,
        dropped = false,
        setupTimeMs,
        mos,
        reasonCode,
        reasonLabel,
        reasonSource,
      } = sample || {};

      if (attempt) next.voice.attempts += 1;
      if (setupSuccessful) next.voice.setupOk += 1;
      if (callCompleted) next.voice.completed += 1;
      if (dropped) next.voice.dropped += 1;
      if (typeof setupTimeMs === 'number') {
        next.voice.setupTimes = [...next.voice.setupTimes, setupTimeMs];
      }
      if (typeof mos === 'number') {
        next.voice.mosSamples = [...next.voice.mosSamples, mos];
      }
      if (reasonLabel || reasonCode !== undefined) {
        next.voice.reasons = [
          ...(next.voice.reasons || []),
          {
            timestamp: Date.now(),
            code: reasonCode,
            label: reasonLabel,
            source: reasonSource,
          },
        ].slice(-50); // keep last 50 reasons to avoid unbounded growth
      }
      return next;
    });
  }, []);

  const addHttpSample = useCallback((direction, sample) => {
    setMetrics((current) => {
      if (!['dl', 'ul'].includes(direction)) return current;
      const currentDirection = current.data.http[direction];
      const next = {
        ...current,
        data: {
          ...current.data,
          http: {
            ...current.data.http,
            [direction]: { ...currentDirection },
          },
        },
      };

      const {
        request = true,
        completed = false,
        throughputMbps,
      } = sample || {};

      console.log(`[Data] HTTP ${direction} sample:`, { request, completed, throughputMbps });

      if (request) next.data.http[direction].requests += 1;
      if (completed) next.data.http[direction].completed += 1;
      if (typeof throughputMbps === 'number') {
        next.data.http[direction].throughputs = [
          ...next.data.http[direction].throughputs,
          throughputMbps,
        ];
      }
      return next;
    });
  }, []);

  const addBrowsingSample = useCallback((sample) => {
    setMetrics((current) => {
      const next = {
        ...current,
        data: {
          ...current.data,
          browsing: { ...current.data.browsing },
        },
      };
      const {
        request = true,
        completed = false,
        durationMs,
        dnsResolutionTimeMs,
        throughputKbps,
      } = sample || {};

      console.log('[Data] Browsing sample:', { request, completed, durationMs, dnsResolutionTimeMs, throughputKbps });

      if (request) next.data.browsing.requests += 1;
      if (completed) next.data.browsing.completed += 1;
      if (typeof durationMs === 'number') {
        next.data.browsing.durations = [
          ...next.data.browsing.durations,
          durationMs,
        ];
      }
      if (typeof dnsResolutionTimeMs === 'number') {
        next.data.browsing.dnsResolutionTimes = [
          ...(next.data.browsing.dnsResolutionTimes || []),
          dnsResolutionTimeMs,
        ];
      }
      if (typeof throughputKbps === 'number') {
        next.data.browsing.throughputs = [
          ...(next.data.browsing.throughputs || []),
          throughputKbps,
        ];
      }
      return next;
    });
  }, []);

  const addStreamingSample = useCallback((sample) => {
    setMetrics((current) => {
      const next = {
        ...current,
        data: {
          ...current.data,
          streaming: { ...current.data.streaming },
        },
      };
      const {
        request = true,
        completed = false,
        mos,
        setupTimeMs,
        throughputKbps,
      } = sample || {};

      console.log('[Data] Streaming sample:', { request, completed, mos, setupTimeMs, throughputKbps });

      if (request) next.data.streaming.requests += 1;
      if (completed) next.data.streaming.completed += 1;
      if (typeof mos === 'number') {
        next.data.streaming.mosSamples = [
          ...next.data.streaming.mosSamples,
          mos,
        ];
      }
      if (typeof setupTimeMs === 'number') {
        next.data.streaming.setupTimes = [
          ...next.data.streaming.setupTimes,
          setupTimeMs,
        ];
      }
      if (typeof throughputKbps === 'number') {
        next.data.streaming.throughputs = [
          ...(next.data.streaming.throughputs || []),
          throughputKbps,
        ];
      }
      return next;
    });
  }, []);

  const addSocialSample = useCallback((sample) => {
    setMetrics((current) => {
      const next = {
        ...current,
        data: {
          ...current.data,
          social: { ...current.data.social },
        },
      };
      const {
        request = true,
        completed = false,
        durationMs,
        throughputKbps,
      } = sample || {};

      console.log('[Data] Social sample:', { request, completed, durationMs, throughputKbps });

      if (request) next.data.social.requests += 1;
      if (completed) next.data.social.completed += 1;
      if (typeof durationMs === 'number') {
        next.data.social.durations = [
          ...next.data.social.durations,
          durationMs,
        ];
      }
      if (typeof throughputKbps === 'number') {
        next.data.social.throughputs = [
          ...(next.data.social.throughputs || []),
          throughputKbps,
        ];
      }
      return next;
    });
  }, []);

  const scores = useMemo(() => calculateScores(metrics), [metrics]);

  // Persist metrics to storage whenever they change
  useEffect(() => {
    const saveMetrics = async () => {
      try {
        await AsyncStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
      } catch (error) {
        console.error('[QoE] Failed to persist metrics:', error);
      }
    };
    saveMetrics();
  }, [metrics]);

  // Debug logging for data metrics
  useEffect(() => {
    console.log('[Data] Metrics updated:', {
      browsing: {
        requests: metrics.data.browsing.requests,
        completed: metrics.data.browsing.completed,
        durationsCount: metrics.data.browsing.durations?.length || 0,
        dnsTimesCount: metrics.data.browsing.dnsResolutionTimes?.length || 0,
        throughputsCount: metrics.data.browsing.throughputs?.length || 0,
      },
      streaming: {
        requests: metrics.data.streaming.requests,
        completed: metrics.data.streaming.completed,
        setupTimesCount: metrics.data.streaming.setupTimes?.length || 0,
        mosCount: metrics.data.streaming.mosSamples?.length || 0,
        throughputsCount: metrics.data.streaming.throughputs?.length || 0,
      },
      http: {
        dl: {
          requests: metrics.data.http.dl.requests,
          completed: metrics.data.http.dl.completed,
          throughputsCount: metrics.data.http.dl.throughputs?.length || 0,
        },
        ul: {
          requests: metrics.data.http.ul.requests,
          completed: metrics.data.http.ul.completed,
          throughputsCount: metrics.data.http.ul.throughputs?.length || 0,
        },
      },
      social: {
        requests: metrics.data.social.requests,
        completed: metrics.data.social.completed,
        durationsCount: metrics.data.social.durations?.length || 0,
        throughputsCount: metrics.data.social.throughputs?.length || 0,
      },
    });
  }, [metrics]);

  // Debug logging for data scores
  useEffect(() => {
    console.log('[Data] Scores calculated:', {
      browsing: scores.browsing?.score,
      streaming: scores.streaming?.score,
      http: scores.http?.score,
      social: scores.social?.score,
      data: scores.data?.score,
      dataAppliedWeight: scores.data?.appliedWeight,
    });
  }, [scores]);

  const clearHistory = useCallback(async () => {
    try {
      setHistory([]);
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.error('[QoE] Failed to clear history:', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      metrics,
      scores,
      history,
      addVoiceSample,
      addHttpSample,
      addBrowsingSample,
      addStreamingSample,
      addSocialSample,
      resetMetrics,
      saveHistoryEntry,
      clearHistory,
    }),
    [
      metrics,
      scores,
      history,
      addVoiceSample,
      addHttpSample,
      addBrowsingSample,
      addStreamingSample,
      addSocialSample,
      resetMetrics,
      saveHistoryEntry,
      clearHistory,
    ]
  );

  return <QoEContext.Provider value={value}>{children}</QoEContext.Provider>;
};

export const useQoE = () => {
  const context = useContext(QoEContext);
  if (!context) {
    throw new Error('useQoE must be used within a QoEProvider');
  }
  return context;
};


