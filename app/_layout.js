import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { QoEProvider } from '../src/context/QoEContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QoEProvider>
        {/* We hide the Drawer's own header because the Tabs show theirs */}
        <Drawer screenOptions={{ headerShown: false }}>
          <Drawer.Screen
            name="(tabs)" 
            options={{
              drawerLabel: 'Home',
              title: 'Home',
            }}
          />
          <Drawer.Screen
            name="settings" 
            options={{
              drawerLabel: 'Settings',
              title: 'App Settings',
              headerShown: true, // Show header for settings since it has no tabs
              headerStyle: { height: 70 },
            }}
          />
        </Drawer>
      </QoEProvider>
    </GestureHandlerRootView>
  );
}