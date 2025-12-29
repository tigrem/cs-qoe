import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// ✅ Modern Expo Modules way to import your Kotlin module
const DeviceDiagnosticModule = requireNativeModule('DeviceDiagnosticModule');

const Card = ({ title, children, accent = "#007AFF" }) => (
  <View style={[styles.card, { borderTopColor: accent }]}>
    <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text>
    <View style={styles.grid}>{children}</View>
  </View>
);

const Kpi = ({ label, value, color = "#1C1C1E" }) => (
  <View style={styles.kpiContainer}>
    <Text style={styles.kpiLabel}>{label}</Text>
    <Text style={[styles.kpiValue, { color }]}>{value || '---'}</Text>
  </View>
);

export default function NetworkTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = useCallback(async () => {
    try {
      // ✅ Using the AsyncFunction defined in our Kotlin module
      const res = await DeviceDiagnosticModule.getFullDiagnostics();
      setData({ ...res, _ts: new Date().toLocaleTimeString() });
    } catch (error) {
      console.error("Diagnostic Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestFullPermissions = async () => {
      if (Platform.OS !== 'android') return;

      try {
        // STEP 1: Request Foreground Location & Phone State
        const foregroundPerms = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        ];

        const granted = await PermissionsAndroid.requestMultiple(foregroundPerms);

        const isFineLocationGranted = 
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        // STEP 2: Request Background Location (Only if Foreground is granted first)
        if (isFineLocationGranted && Platform.Version >= 29) {
          const backgroundStatus = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
          );

          if (!backgroundStatus) {
            Alert.alert(
              "Background Access Required",
              "To monitor signal quality while the app is in the background, please select 'Allow all the time' on the next screen.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Settings",
                  onPress: async () => {
                    await PermissionsAndroid.request(
                      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
                    );
                  }
                }
              ]
            );
          }
        }

        // Initial fetch
        fetchDiagnostics();
      } catch (err) {
        console.warn(err);
      }
    };

    requestFullPermissions();
    const interval = setInterval(fetchDiagnostics, 2000);
    return () => clearInterval(interval);
  }, [fetchDiagnostics]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 15 }}>
      <Text style={styles.updateText}>Last Refresh: {data?._ts}</Text>

      <Card title="DEVICE INFORMATION" accent="#5856D6">
        <Kpi label="Brand" value={data?.brand} />
        <Kpi label="Model" value={data?.model} />
        <Kpi label="Android Ver" value={data?.version} />
        <Kpi label="Operator" value={data?.operator} color="#007AFF" />
      </Card>

      <Card title={`SIGNAL QUALITY (${data?.netType || 'N/A'})`} accent="#007AFF">
        <Kpi label="RSRP" value={data?.rsrp ? data.rsrp + " dBm" : "---"} color="#007AFF" />
        <Kpi label="RSRQ" value={data?.rsrq ? data.rsrq + " dB" : "---"} color="#FF9500" />
        <Kpi label="RSSNR" value={data?.rssnr} color="#4CD964" />
        <Kpi label="CQI" value={data?.cqi} color="#AF52DE" />
      </Card>

      <Card title="CELL IDENTITY" accent="#34C759">
        <Kpi label="Site ID (eNB)" value={data?.enb} />
        <Kpi label="Cell ID" value={data?.cellId} />
        <Kpi label="PCI" value={data?.pci} />
        <Kpi label="TAC" value={data?.tac} />
        <Kpi label="ECI" value={data?.eci} />
      </Card>

      <Card title="NETWORK STATES" accent="#007AFF">
        <Kpi label="Data State" value={data?.dataState} />
        <Kpi label="Data Activity" value={data?.dataActivity} />
        <Kpi label="Call State" value={data?.callState} />
        <Kpi label="SIM State" value={data?.simState} />
        <Kpi label="Roaming" value={data?.isRoaming} />
      </Card>

      <Card title="GPS LOCATION" accent="#FF9500">
        <Kpi label="Latitude" value={data?.lat} />
        <Kpi label="Longitude" value={data?.lon} />
        <Kpi label="Accuracy" value={data?.accuracy ? data.accuracy + "m" : "---"} />
        <Kpi label="Altitude" value={data?.alt ? data.alt + "m" : "---"} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  updateText: { fontSize: 11, color: '#8E8E93', marginBottom: 15 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 15, marginBottom: 15, borderTopWidth: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardTitle: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 15, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiContainer: { width: '50%', marginBottom: 12 },
  kpiLabel: { fontSize: 11, color: '#8E8E93', textTransform: 'uppercase' },
  kpiValue: { fontSize: 16, fontWeight: '600', marginTop: 2 }
});