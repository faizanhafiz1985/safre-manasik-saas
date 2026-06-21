import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import api from '../api/client';
import { getAccessToken } from '../auth/storage';
import { API_BASE_URL } from '../config';
import { COLORS } from '../theme';

// Renders the server-generated voucher HTML. The /vouchers/preview endpoint
// accepts the JWT as a ?token= query param (flexAuth), so it works inside a WebView.
export default function VoucherScreen({ route }) {
  const { id, type } = route.params;
  const [uri, setUri] = useState(null);

  useEffect(() => {
    (async () => {
      // Touch an authed endpoint first so the interceptor refreshes the access
      // token if it has expired — the WebView URL can't refresh on its own.
      try { await api.get('/auth/me'); } catch { /* ignore */ }
      const token = await getAccessToken();
      setUri(`${API_BASE_URL}/vouchers/preview/${id}?type=${type}&token=${encodeURIComponent(token || '')}`);
    })();
  }, [id, type]);

  if (!uri) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <WebView
      source={{ uri }}
      startInLoadingState
      renderLoading={() => <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>}
      renderError={() => <View style={styles.center}><Text style={styles.muted}>Could not load voucher.</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
});
