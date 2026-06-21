import { navigationRef } from '../navigation/RootNavigator';

// Routes a tapped push notification to the right screen using its `data` payload
// (set server-side in pushService): booking_status → BookingDetail, payment_received → Payments.
// Waits for navigation to be ready (handles cold-start taps).
export function routeNotification(data) {
  if (!data || !data.type) return;
  let tries = 0;
  const go = () => {
    if (!navigationRef.isReady()) {
      if (tries++ < 20) setTimeout(go, 400);
      return;
    }
    try {
      if ((data.type === 'booking_status' || data.type === 'payment_received') && data.bookingId) {
        const screen = data.type === 'payment_received' ? 'Payments' : 'BookingDetail';
        navigationRef.navigate('App', { screen: 'Bookings', params: { screen, params: { id: data.bookingId } } });
      }
    } catch { /* not logged in / route unavailable — ignore */ }
  };
  go();
}
