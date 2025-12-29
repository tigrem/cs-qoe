import { View, Text, StyleSheet, Button, Alert, Platform, PermissionsAndroid, ScrollView, Linking, NativeModules, NativeEventEmitter } from 'react-native';
import { useEffect, useState, useRef, useMemo } from 'react';
import { useQoE } from '../../src/context/QoEContext';
import CallMetrics, {
  CallStateChangePayload,
} from 'call-metrics';

export default function VoiceScreen() {
  const { addVoiceSample, metrics, scores } = useQoE();
  const [lastEvent, setLastEvent] = useState(null);
  const [lastReason, setLastReason] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const callStartTimeRef = useRef(null);
  const callSetupStartTimeRef = useRef(null);
  const { CallDisconnectModule } = NativeModules;
  const disconnectEmitter = useMemo(
    () => (CallDisconnectModule ? new NativeEventEmitter(CallDisconnectModule) : null),
    [CallDisconnectModule]
  );

  // Debug logging for metrics
  useEffect(() => {
    console.log('[Voice] Metrics updated:', {
      attempts: metrics.voice.attempts,
      setupOk: metrics.voice.setupOk,
      completed: metrics.voice.completed,
      dropped: metrics.voice.dropped,
      setupTimes: metrics.voice.setupTimes,
      mosSamples: metrics.voice.mosSamples,
    });
  }, [metrics]);

  // Debug logging for scores
  useEffect(() => {
    console.log('[Voice] Scores calculated:', {
      cssr: scores.voice.cssr,
      cdr: scores.voice.cdr,
      cstAvg: scores.voice.cstAvg,
      mosAvg: scores.voice.mosAvg,
    });
  }, [scores]);

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '--';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatTime = (ms) => {
    if (ms === null || ms === undefined) return '--';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatMOS = (value) => {
    if (value === null || value === undefined) return '--';
    return value.toFixed(2);
  };

  useEffect(() => {
    const subscription = CallMetrics.addListener(
      'callMetrics:update',
      (payload: CallStateChangePayload) => {
        setLastEvent(payload);
        const now = Date.now();

        console.log('[Voice] Call state changed:', payload.state, payload);

        if (payload.state === 'ringing') {
          // Call is ringing - start tracking setup time
          console.log('[Voice] Call ringing - starting setup timer');
          callSetupStartTimeRef.current = now;
          addVoiceSample({
            attempt: true,
          });
        } else if (payload.state === 'offhook') {
          // Call answered - calculate setup time
          if (callSetupStartTimeRef.current !== null) {
            const setupTime = now - callSetupStartTimeRef.current;
            console.log('[Voice] Call answered - setup time:', setupTime, 'ms');
            addVoiceSample({
              setupSuccessful: true,
              setupTimeMs: setupTime,
            });
            callSetupStartTimeRef.current = null;
          } else {
            // If we missed ringing state, use a default setup time or estimate
            // For outgoing calls, setup is usually very fast (< 1 second)
            console.log('[Voice] Call answered (missed ringing state) - using estimated setup time');
            // Estimate setup time as 500ms for outgoing calls
            addVoiceSample({
              attempt: true,
              setupSuccessful: true,
              setupTimeMs: 500, // Estimated setup time for outgoing calls
            });
          }
          callStartTimeRef.current = now;
        } else if (payload.state === 'idle') {
          // Call ended
          if (callStartTimeRef.current !== null) {
            // Call was answered (offhook happened)
            const callDuration = now - callStartTimeRef.current;
            // If call lasted less than 5 seconds, consider it dropped
            const wasDropped = callDuration < 5000;
            console.log('[Voice] Call ended - duration:', callDuration, 'ms, dropped:', wasDropped);
            
            // Don't increment attempts here - attempt was already counted when call started
            addVoiceSample({
              attempt: false, // Explicitly set to false to prevent double-counting
              callCompleted: !wasDropped,
              dropped: wasDropped,
            });
            
            callStartTimeRef.current = null;
          } else if (callSetupStartTimeRef.current !== null) {
            // Call ended while ringing (missed call) - this is a failed setup attempt
            console.log('[Voice] Call ended while ringing (missed call) - failed setup');
            const setupTime = now - callSetupStartTimeRef.current;
            callSetupStartTimeRef.current = null;
            // Attempt was already counted when ringing started
            // This is a failed setup attempt (ringing but not answered)
            // We don't need to add anything here since attempt was already counted
            // and setupSuccessful defaults to false, so CSSR will be correct
          } else {
            // Call ended without any prior state - ignore this (initial state or app startup)
            console.log('[Voice] Call ended without prior state - ignoring');
          }
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [addVoiceSample]);

  // Listen for native disconnect causes (PSTN) if available
  useEffect(() => {
    if (!disconnectEmitter || !CallDisconnectModule?.startListening) {
      console.log('[Voice] CallDisconnectModule not available:', { disconnectEmitter: !!disconnectEmitter, CallDisconnectModule: !!CallDisconnectModule });
      return;
    }

    const sub = disconnectEmitter.addListener('CallDisconnectEvent', (payload) => {
      console.log('[Voice] CallDisconnectEvent received:', payload);
      setLastReason(payload);
      if (payload?.causeCode !== undefined || payload?.causeLabel) {
        addVoiceSample({
          attempt: false,
          callCompleted: false,
          dropped: false,
          reasonCode: payload?.causeCode,
          reasonLabel: payload?.causeLabel || payload?.state,
          reasonSource: payload?.source || 'native',
        });
      }
    });

    // Don't auto-start here - wait for user to click "Start listener"
    console.log('[Voice] CallDisconnectEvent listener registered');

    return () => {
      sub?.remove();
    };
  }, [disconnectEmitter, CallDisconnectModule, addVoiceSample]);

  const handleStart = async () => {
    try {
      let granted = CallMetrics.isPermissionGranted();
      
      if (!granted && Platform.OS === 'android') {
        // Request permissions (READ_PHONE_STATE and READ_CALL_LOG)
        const permissions = [
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        ];
        
        const results = await PermissionsAndroid.requestMultiple(permissions);
        granted = results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;
        const callLogGranted = results[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] === PermissionsAndroid.RESULTS.GRANTED;
        
        if (!granted) {
          // Permission denied - check if we should show rationale
          // If false, it means permanently denied (user selected "Don't ask again")
          const shouldShowRationale = await PermissionsAndroid.shouldShowRequestPermissionRationale(
            PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE
          );
          
          if (!shouldShowRationale) {
            // Permanently denied - open settings
            Alert.alert(
              'Permission Required',
              'Phone permission was denied. Please enable it in app settings to use call metrics.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    Linking.openSettings();
                  },
                },
              ]
            );
          } else {
            // Not permanently denied - user can try again later
            Alert.alert(
              'Permission required',
              'Phone permission is required to monitor call metrics. Please grant the permission when prompted.'
            );
          }
          return;
        }
        
        if (!callLogGranted) {
          console.warn('[Voice] READ_CALL_LOG permission denied - disconnect causes from call logs will not be available');
        }
      }
      
      // Re-check permission after request
      granted = CallMetrics.isPermissionGranted();
      
      if (granted) {
        await CallMetrics.start();
        
        // Also start the disconnect cause listener if available
        if (CallDisconnectModule?.startListening) {
          try {
            await CallDisconnectModule.startListening();
            console.log('[Voice] CallDisconnectModule started successfully');
          } catch (e) {
            console.warn('[Voice] CallDisconnectModule start failed:', e);
            Alert.alert('Warning', 'Call metrics started but disconnect cause listener failed: ' + e.message);
          }
        } else {
          console.warn('[Voice] CallDisconnectModule not available');
        }
        
        setIsListening(true);
        Alert.alert('Success', 'Call listener started. Make or receive a call to see events.');
      } else {
        Alert.alert(
          'Permission required',
          'Phone permission is required. Please grant it in app settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
              },
            },
          ]
        );
      }
    } catch (e) {
      console.warn('Failed to start CallMetrics', e);
      Alert.alert('Error', 'Failed to start call metrics listener: ' + e.message);
    }
  };

  const handleStop = async () => {
    try {
      await CallMetrics.stop();
      if (CallDisconnectModule?.stopListening) {
        try {
          await CallDisconnectModule.stopListening();
          console.log('[Voice] CallDisconnectModule stopped');
        } catch (e) {
          console.warn('[Voice] CallDisconnectModule stop failed:', e);
        }
      }
      setIsListening(false);
    } catch (e) {
      console.warn('Failed to stop CallMetrics', e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Voice QoE</Text>
      <Text style={styles.subtitle}>
        Native module is listening to Android call state. Make and end calls to
        see events.
      </Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>Status</Text>
        <Text style={[styles.statusText, isListening && styles.statusActive]}>
          {isListening ? '🟢 Listening for call events' : '⚪ Listener stopped'}
        </Text>
      </View>

      <View style={styles.buttonsRow}>
        <Button title="Start listener" onPress={handleStart} disabled={isListening} />
        <Button title="Stop listener" onPress={handleStop} disabled={!isListening} />
      </View>

      <View style={styles.metricsBox}>
        <Text style={styles.sectionTitle}>Voice Metrics</Text>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Call Setup Success Rate (CSSR)</Text>
          <Text style={styles.metricValue}>
            {formatPercent(scores.voice.cssr)}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Call Drop Rate (CDR)</Text>
          <Text style={styles.metricValue}>
            {formatPercent(scores.voice.cdr)}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Avg Call Setup Time</Text>
          <Text style={styles.metricValue}>
            {formatTime(scores.voice.cstAvg)}
          </Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Mean Opinion Score (MOS)</Text>
          <Text style={styles.metricValue}>
            {formatMOS(scores.voice.mosAvg)}
          </Text>
        </View>
        {scores.voice.mosAvg === null && (
          <Text style={styles.noteText}>
            Note: MOS requires audio quality measurements (not yet implemented)
          </Text>
        )}

        <View style={styles.divider} />

        <Text style={styles.subsectionTitle}>Raw Statistics</Text>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Total Attempts</Text>
          <Text style={styles.metricValue}>{metrics.voice.attempts}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Setup Successful</Text>
          <Text style={styles.metricValue}>{metrics.voice.setupOk}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Calls Completed</Text>
          <Text style={styles.metricValue}>{metrics.voice.completed}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Calls Dropped</Text>
          <Text style={styles.metricValue}>{metrics.voice.dropped}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Setup Time Samples</Text>
          <Text style={styles.metricValue}>{metrics.voice.setupTimes?.length || 0}</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>MOS Samples</Text>
          <Text style={styles.metricValue}>{metrics.voice.mosSamples?.length || 0}</Text>
        </View>
      </View>

      <View style={styles.lastEventBox}>
        <Text style={styles.lastEventTitle}>Last call state event</Text>
        <Text style={styles.lastEventText}>
          {lastEvent
            ? `${lastEvent.state} @ ${new Date(
                lastEvent.timestamp
              ).toLocaleTimeString()}`
            : 'No events yet'}
        </Text>
        {lastEvent && (
          <Text style={styles.eventDetails}>
            Phone: {lastEvent.phoneNumber || 'N/A'}
          </Text>
        )}
      </View>

      <View style={styles.lastEventBox}>
        <Text style={styles.lastEventTitle}>Last disconnect reason (native)</Text>
        <Text style={styles.lastEventText}>
          {lastReason
            ? `${lastReason.causeLabel || 'Unknown'} (${lastReason.causeCode ?? 'n/a'})`
            : 'No disconnect causes yet'}
        </Text>
        {lastReason?.timestamp && (
          <Text style={styles.eventDetails}>
            At: {new Date(lastReason.timestamp).toLocaleTimeString()} · Source: {lastReason.source || 'native'}
          </Text>
        )}
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
  },
  statusBox: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
    marginTop: 24,
    marginBottom: 16,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statusActive: {
    color: '#10b981',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricsBox: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  subsectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a44',
  },
  metricLabel: {
    color: '#9ca3af',
    fontSize: 14,
    flex: 1,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#1f2a44',
    marginVertical: 12,
  },
  lastEventBox: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  lastEventTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  lastEventText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  eventDetails: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  noteText: {
    color: '#6b7280',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
});


