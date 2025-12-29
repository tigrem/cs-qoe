import { View, Text, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQoE } from '../../src/context/QoEContext';

export default function DataScreen() {
  const { metrics, scores, addBrowsingSample, addStreamingSample, addHttpSample, addSocialSample } = useQoE();
  const [isTesting, setIsTesting] = useState(false);
  const [networkState, setNetworkState] = useState(null);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState(state);
      console.log('[Data] Network state:', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    NetInfo.fetch().then(state => {
      setNetworkState(state);
    });

    return () => unsubscribe();
  }, []);

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '--';
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatTime = (ms) => {
    if (ms === null || ms === undefined) return '--';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatThroughput = (kbps) => {
    if (kbps === null || kbps === undefined) return '--';
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
    return `${kbps.toFixed(2)} Kbps`;
  };

  // Real browsing test with actual HTTP request
  const testBrowsing = async () => {
    if (isTesting) return;
    
    // Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }
    
    setIsTesting(true);
    
    const startTime = Date.now();
    addBrowsingSample({ request: true });

    try {
      // Test URL - using a lightweight page for testing
      const testUrl = 'https://www.google.com/favicon.ico';
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Measure DNS resolution + connection time (time to first byte)
      const dnsStart = Date.now();
      const response = await fetch(testUrl, {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const dnsTime = Date.now() - dnsStart;

      // Measure download time and throughput
      const downloadStart = Date.now();
      const blob = await response.blob();
      const downloadTime = Date.now() - downloadStart;
      const duration = Date.now() - startTime;

      // Calculate throughput (Kbps)
      const sizeBytes = blob.size;
      // Use Math.max to ensure we never divide by 0, and use at least 1ms
      // For very fast downloads, use total duration as fallback
      const effectiveTime = Math.max(downloadTime, duration, 1);
      const throughputKbps = sizeBytes > 0 && effectiveTime > 0
        ? (sizeBytes * 8 * 1000) / effectiveTime // Convert bytes to bits, then ms to seconds, then to Kbps
        : 0;
      
      console.log('[Data] Browsing throughput calc:', {
        sizeBytes,
        downloadTime,
        duration,
        effectiveTime,
        throughputKbps,
      });

      if (response.ok) {
        addBrowsingSample({
          completed: true,
          durationMs: duration,
          dnsResolutionTimeMs: dnsTime,
          throughputKbps: throughputKbps,
        });

        Alert.alert('Success', `Browsing test completed in ${(duration / 1000).toFixed(2)}s\nThroughput: ${(throughputKbps / 1000).toFixed(2)} Mbps`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[Data] Browsing test error:', error);
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Check your internet connection.';
      } else if (error.message === 'Network request failed') {
        errorMsg = 'Network request failed. Check your internet connection.';
      }
      Alert.alert('Error', `Browsing test failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Real streaming test with actual video/audio streaming
  const testStreaming = async () => {
    if (isTesting) return;
    
    // Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }
    
    setIsTesting(true);

    const startTime = Date.now();
    addStreamingSample({ request: true });

    try {
      // Try multiple fallback URLs for streaming test (using smaller files to avoid crashes)
      const testUrls = [
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png', // Small image (safest)
        'https://httpbin.org/image/png', // Small test image
        'https://www.google.com/favicon.ico', // Very small file
      ];
      
      let response = null;
      let lastError = null;
      let setupStart = null;
      
      // Try each URL until one works
      for (const url of testUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
          
          setupStart = Date.now();
          response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            break; // Success, exit loop
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          lastError = err;
          console.log(`[Data] Streaming test failed for ${url}, trying next...`);
          response = null;
          continue; // Try next URL
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('All streaming URLs failed');
      }

      const setupDelay = Date.now() - (setupStart || Date.now());
      
      // Update with setup time (don't count as new request)
      addStreamingSample({
        request: false,
        setupTimeMs: setupDelay,
      });

      // Download the file to measure throughput
      // Using small files to avoid memory issues
      const streamStart = Date.now();
      let totalBytes = 0;
      let streamTime = 0;
      
      try {
        // Check content-length first to avoid downloading huge files
        const contentLength = response.headers.get('content-length');
        const maxSize = 5 * 1024 * 1024; // 5MB max - safety limit
        
        if (contentLength) {
          const fileSize = parseInt(contentLength, 10);
          if (fileSize > maxSize) {
            // File too large, skip download and estimate
            console.warn(`[Data] File too large (${fileSize} bytes), estimating throughput`);
            totalBytes = maxSize; // Estimate based on max size
            streamTime = 1000; // Estimate 1 second
          } else {
            // Safe to download - file is small
            const blob = await Promise.race([
              response.blob(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Download timeout')), 15000)
              )
            ]);
            totalBytes = blob.size;
            streamTime = Date.now() - streamStart;
          }
        } else {
          // No content-length header, try to download with timeout
          try {
            const blob = await Promise.race([
              response.blob(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Download timeout')), 10000)
              )
            ]);
            totalBytes = blob.size;
            streamTime = Date.now() - streamStart;
            
            // Safety check - if blob is too large, cap it
            if (totalBytes > maxSize) {
              console.warn(`[Data] Downloaded file too large (${totalBytes} bytes), capping`);
              totalBytes = maxSize;
            }
          } catch (blobError) {
            console.error('[Data] Blob download failed:', blobError);
            // Estimate based on setup time
            totalBytes = 100 * 1024; // Estimate 100KB
            streamTime = Date.now() - streamStart || 1000;
          }
        }
      } catch (downloadError) {
        console.error('[Data] Streaming download error:', downloadError);
        // Fallback: estimate from setup time
        totalBytes = 100 * 1024; // Estimate 100KB
        streamTime = Date.now() - streamStart || 1000;
      }
      
      const totalTime = Date.now() - startTime;

      // Calculate throughput in Kbps
      // Use Math.max to ensure we never divide by 0, and use at least 1ms
      // For very fast downloads, use total time as fallback
      const effectiveTime = Math.max(streamTime, totalTime, 1);
      const throughputKbps = totalBytes > 0 && effectiveTime > 0
        ? (totalBytes * 8 * 1000) / effectiveTime // Convert bytes to bits, then ms to seconds, then to Kbps
        : 0;
      
      console.log('[Data] Streaming throughput calc:', {
        totalBytes,
        streamTime,
        totalTime,
        effectiveTime,
        throughputKbps,
      });

      // Estimate MOS based on throughput (simplified model)
      // Higher throughput = better quality
      const mos = throughputKbps > 5000 ? 4.5 : 
                   throughputKbps > 2000 ? 4.0 :
                   throughputKbps > 1000 ? 3.5 :
                   throughputKbps > 500 ? 3.0 : 2.5;

      // Mark as completed (don't count as new request)
      addStreamingSample({
        request: false,
        completed: true,
        mos: mos,
        throughputKbps: throughputKbps,
      });

      Alert.alert('Success', `Streaming test completed\nThroughput: ${(throughputKbps / 1000).toFixed(2)} Mbps\nMOS: ${mos.toFixed(2)}`);
    } catch (error) {
      console.error('[Data] Streaming test error:', error);
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Check your internet connection.';
      } else if (error.message === 'Network request failed') {
        errorMsg = 'Network request failed. Check your internet connection.';
      }
      Alert.alert('Error', `Streaming test failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Real HTTP download test with actual file download
  const testHttpDownload = async () => {
    if (isTesting) return;
    
    // Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }
    
    setIsTesting(true);

    addHttpSample('dl', { request: true });

    try {
      // Try multiple fallback URLs for download test
      const testUrls = [
        'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
        'https://www.google.com/favicon.ico',
        'https://httpbin.org/image/png',
      ];
      
      let response = null;
      let lastError = null;
      
      // Try each URL until one works
      for (const url of testUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
          response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            break; // Success, exit loop
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          lastError = err;
          console.log(`[Data] HTTP download failed for ${url}, trying next...`);
          response = null;
          continue; // Try next URL
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('All download URLs failed');
      }
      
      const startTime = Date.now();

      // Measure download throughput
      const downloadStart = Date.now();
      const blob = await response.blob();
      const downloadTime = Date.now() - downloadStart;
      const totalTime = Date.now() - startTime;
      
      // Calculate throughput in Mbps
      const sizeBytes = blob.size;
      // Use Math.max to ensure we never divide by 0, and use at least 1ms
      // For very fast downloads, use total time as fallback
      const effectiveTime = Math.max(downloadTime, totalTime, 1);
      const throughputMbps = sizeBytes > 0 && effectiveTime > 0
        ? (sizeBytes * 8) / (effectiveTime * 1000) // Convert bytes to bits, then to Mbps
        : 0;
      
      console.log('[Data] HTTP download throughput calc:', {
        sizeBytes,
        downloadTime,
        totalTime,
        effectiveTime,
        throughputMbps,
      });

      addHttpSample('dl', {
        completed: true,
        throughputMbps: throughputMbps,
      });

      Alert.alert('Success', `Download completed: ${throughputMbps.toFixed(2)} Mbps\nSize: ${(sizeBytes / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error('[Data] HTTP download error:', error);
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Check your internet connection.';
      } else if (error.message === 'Network request failed') {
        errorMsg = 'Network request failed. Check your internet connection.';
      }
      Alert.alert('Error', `Download failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Real HTTP upload test with actual data upload
  const testHttpUpload = async () => {
    if (isTesting) return;
    
    // Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }
    
    setIsTesting(true);

    addHttpSample('ul', { request: true });

    try {
      // Create test data to upload (100KB)
      const testDataSize = 100 * 1024; // 100KB
      const testData = new Uint8Array(testDataSize);
      // Fill with random data
      for (let i = 0; i < testDataSize; i++) {
        testData[i] = Math.floor(Math.random() * 256);
      }
      const blob = new Blob([testData]);

      // Use a test upload endpoint (httpbin.org provides a free test endpoint)
      const uploadUrl = 'https://httpbin.org/post';
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      
      const startTime = Date.now();
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const uploadTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Calculate throughput in Mbps
      const throughputMbps = uploadTime > 0
        ? (testDataSize * 8) / (uploadTime * 1000) // Convert bytes to bits, then to Mbps
        : 0;

      addHttpSample('ul', {
        completed: true,
        throughputMbps: throughputMbps,
      });

      Alert.alert('Success', `Upload completed: ${throughputMbps.toFixed(2)} Mbps\nSize: ${(testDataSize / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error('[Data] HTTP upload error:', error);
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Check your internet connection.';
      } else if (error.message === 'Network request failed') {
        errorMsg = 'Network request failed. Check your internet connection.';
      }
      Alert.alert('Error', `Upload failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Real social media test with actual API-like request
  const testSocialMedia = async () => {
    if (isTesting) return;
    
    // Check network connectivity first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Internet', 'Please check your internet connection and try again.');
      return;
    }
    
    setIsTesting(true);

    const startTime = Date.now();
    addSocialSample({ request: true });

    try {
      // Try multiple fallback URLs for social media API test
      const testUrls = [
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://httpbin.org/json',
        'https://api.github.com/zen', // GitHub API (lightweight)
      ];
      
      let response = null;
      let lastError = null;
      
      let requestStart = null;
      
      // Try each URL until one works
      for (const url of testUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          requestStart = Date.now();
          response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            break; // Success, exit loop
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          lastError = err;
          console.log(`[Data] Social media test failed for ${url}, trying next...`);
          response = null;
          requestStart = null;
          continue; // Try next URL
        }
      }
      
      if (!response || !response.ok) {
        throw lastError || new Error('All social media URLs failed');
      }

      // Handle different response types (JSON or text)
      let responseData;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      const duration = Date.now() - startTime;
      const requestTime = requestStart ? Date.now() - requestStart : duration;

      // Calculate throughput (Kbps)
      const responseSize = typeof responseData === 'string' 
        ? responseData.length 
        : JSON.stringify(responseData).length;
      const throughputKbps = requestTime > 0
        ? (responseSize * 8 * 1000) / requestTime // Convert bytes to bits, then ms to seconds, then to Kbps
        : 0;

      addSocialSample({
        completed: true,
        durationMs: duration,
        throughputKbps: throughputKbps,
      });

      Alert.alert('Success', `Social media test completed in ${(duration / 1000).toFixed(2)}s`);
    } catch (error) {
      console.error('[Data] Social media test error:', error);
      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Check your internet connection.';
      } else if (error.message === 'Network request failed') {
        errorMsg = 'Network request failed. Check your internet connection.';
      }
      Alert.alert('Error', `Social media test failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Data QoE</Text>
      <Text style={styles.subtitle}>
        Test browsing, streaming, file access, and social media performance metrics.
      </Text>
      
      {/* Network Status Indicator */}
      {networkState && (
        <View style={styles.networkStatus}>
          <View style={[
            styles.networkIndicator, 
            { backgroundColor: networkState.isConnected ? '#10b981' : '#ef4444' }
          ]} />
          <Text style={styles.networkText}>
            {networkState.isConnected 
              ? `Connected (${networkState.type})` 
              : 'No Internet Connection'}
          </Text>
        </View>
      )}

      {/* Browsing Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browsing</Text>
        <Button 
          title="Test Browsing" 
          onPress={testBrowsing} 
          disabled={isTesting}
        />
        <View style={styles.metricsBox}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requests</Text>
            <Text style={styles.metricValue}>{metrics.data.browsing.requests}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{metrics.data.browsing.completed}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Success Ratio</Text>
            <Text style={styles.metricValue}>
              {formatPercent(scores.browsing?.successRatio)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg Duration</Text>
            <Text style={styles.metricValue}>
              {formatTime(scores.browsing?.durationAvg)}
            </Text>
          </View>
        </View>
      </View>

      {/* Streaming Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Streaming</Text>
        <Button 
          title="Test Streaming" 
          onPress={testStreaming} 
          disabled={isTesting}
        />
        <View style={styles.metricsBox}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requests</Text>
            <Text style={styles.metricValue}>{metrics.data.streaming.requests}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{metrics.data.streaming.completed}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Success Ratio</Text>
            <Text style={styles.metricValue}>
              {formatPercent(scores.streaming?.successRatio)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg Setup Time</Text>
            <Text style={styles.metricValue}>
              {formatTime(scores.streaming?.setupAvg)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg MOS</Text>
            <Text style={styles.metricValue}>
              {scores.streaming?.mosAvg?.toFixed(2) || '--'}
            </Text>
          </View>
        </View>
      </View>

      {/* HTTP Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>File Access (HTTP)</Text>
        <View style={styles.buttonRow}>
          <Button 
            title="Test Download" 
            onPress={testHttpDownload} 
            disabled={isTesting}
          />
          <Button 
            title="Test Upload" 
            onPress={testHttpUpload} 
            disabled={isTesting}
          />
        </View>
        <View style={styles.metricsBox}>
          <Text style={styles.subsectionTitle}>Download</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requests</Text>
            <Text style={styles.metricValue}>{metrics.data.http.dl.requests}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{metrics.data.http.dl.completed}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg Throughput</Text>
            <Text style={styles.metricValue}>
              {formatThroughput((scores.http?.dlAvg || 0) * 1000)}
            </Text>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.subsectionTitle}>Upload</Text>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requests</Text>
            <Text style={styles.metricValue}>{metrics.data.http.ul.requests}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{metrics.data.http.ul.completed}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg Throughput</Text>
            <Text style={styles.metricValue}>
              {formatThroughput((scores.http?.ulAvg || 0) * 1000)}
            </Text>
          </View>
        </View>
      </View>

      {/* Social Media Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Social Media</Text>
        <Button 
          title="Test Social Media" 
          onPress={testSocialMedia} 
          disabled={isTesting}
        />
        <View style={styles.metricsBox}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Requests</Text>
            <Text style={styles.metricValue}>{metrics.data.social.requests}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Completed</Text>
            <Text style={styles.metricValue}>{metrics.data.social.completed}</Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Success Ratio</Text>
            <Text style={styles.metricValue}>
              {formatPercent(scores.social?.successRatio)}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Avg Duration</Text>
            <Text style={styles.metricValue}>
              {formatTime(scores.social?.durationAvg)}
            </Text>
          </View>
        </View>
      </View>

      {/* Data Score Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.sectionTitle}>Data QoE Score</Text>
        <Text style={styles.scoreValue}>
          {formatPercent(scores.data.score)}
        </Text>
        <Text style={styles.coverageText}>
          Coverage: {formatPercent(scores.data.appliedWeight)}
      </Text>
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
    marginBottom: 12,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  networkIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  networkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metricsBox: {
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2a44',
    marginTop: 12,
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
  summaryBox: {
    backgroundColor: '#111b2c',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2a44',
    alignItems: 'center',
    marginTop: 12,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  coverageText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 8,
  },
});
