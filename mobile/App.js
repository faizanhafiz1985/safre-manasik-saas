import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/auth/AuthContext';
import { I18nProvider } from './src/i18n';
import RootNavigator from './src/navigation/RootNavigator';
import { routeNotification } from './src/push/routeNotification';

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    // Tapping a push notification routes to the relevant screen.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) =>
      routeNotification(resp.notification.request.content.data));
    // Handle a tap that cold-started the app.
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) routeNotification(resp.notification.request.content.data);
    }).catch(() => {});
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
