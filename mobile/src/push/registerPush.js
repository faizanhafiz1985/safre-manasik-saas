import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from '../api/client';

// Registers this device's native FCM/APNs token with the backend (POST /devices).
// The server uses the raw device token (not an Expo push token) because it sends
// via FCM HTTP v1 directly. Push only works in a Dev Build / production build —
// not in Expo Go. Safe to call after login; failures are swallowed.
export async function registerForPush() {
  try {
    if (!Device.isDevice) return; // emulators can't get a push token

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    // Native device token (FCM on Android, APNs on iOS).
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token) {
      await api.post('/devices', { token, platform: Platform.OS });
    }
  } catch (e) {
    // Non-fatal — app works without push.
    console.warn('Push registration skipped:', e?.message);
  }
}

// Call once on unregister/logout if you stored the token; optional.
export async function unregisterPush() {
  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (token) await api.delete(`/devices/${encodeURIComponent(token)}`);
  } catch { /* ignore */ }
}
