import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
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
