import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import api from '../api/client';
import { getAccessToken } from '../auth/storage';
import { API_BASE_URL } from '../config';
import { COLORS } from '../theme';

// Renders a server HTML document (voucher / invoice) that requires a bearer token.
// Passes Authorization as a WebView header (works for the initial document load).
// route.params: { path } e.g. "/voucher-forms/<id>/print".
export default function PrintWebViewScreen({ route }) {
  const { path } = route.params;
  const [source, setSource] = useState(null);

  useEffect(() => {
    (async () => {
      try { await api.get('/auth/me'); } catch { /* refreshes token if expired */ }
      const token = await getAccessToken();
      setSource({ uri: `${API_BASE_URL}${path}`, headers: { Authorization: `Bearer ${token || ''}` } });
    })();
  }, [path]);

  if (!source) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;
  return (
    <WebView
      source={source}
      startInLoadingState
      renderLoading={() => <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>}
      renderError={() => <View style={styles.center}><Text style={styles.muted}>Could not load document.</Text></View>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
});
