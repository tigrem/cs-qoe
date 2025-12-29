import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true, 
        // ⬇️ This adds the 'hamburger' icon to the left of your tab headers
        headerLeft: () => <DrawerToggleButton tintColor="#000" />,
        headerStyle: { 
          height: Platform.OS === 'ios' ? 90 : 70, 
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="call-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="data"
        options={{
          title: 'Data',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wifi-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ntk"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      
      {/* Hide settings from the bottom bar since it's in the sidebar */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null, 
        }}
      />
    </Tabs>
  );
}