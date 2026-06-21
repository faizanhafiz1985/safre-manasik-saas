import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

export default function FleetScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [v, t, a] = await Promise.all([
        api.get('/transport/vehicles').then((r) => r.data).catch(() => []),
        api.get('/fleet/trips').then((r) => r.data).catch(() => []),
        api.get('/fleet/maintenance/alerts').then((r) => r.data).catch(() => []),
      ]);
      setVehicles(Array.isArray(v) ? v : (v.data || []));
      setTrips(Array.isArray(t) ? t : (t.data || []));
      setAlerts(Array.isArray(a) ? a : (a.data || []));
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {alerts.length > 0 && (
        <View style={styles.alert}>
          <Text style={styles.alertText}>⚠️ {alerts.length} maintenance alert{alerts.length > 1 ? 's' : ''} — service due soon.</Text>
        </View>
      )}

      <Text style={styles.section}>My Vehicle{vehicles.length > 1 ? 's' : ''}</Text>
      {vehicles.length === 0 && <Text style={styles.muted}>No vehicle assigned.</Text>}
      {vehicles.map((v) => (
        <View key={v.id} style={styles.card}>
          <Text style={styles.title}>{v.name} <Text style={styles.plate}>{v.plateNumber}</Text></Text>
          <Text style={styles.meta}>{v.type}{v.capacity ? ` • ${v.capacity} seats` : ''}</Text>
          <View style={styles.odoRow}>
            <View style={styles.odoBox}><Text style={styles.odoLabel}>Current Odometer</Text><Text style={styles.odoVal}>{Number(v.currentOdometer || 0).toLocaleString()} km</Text></View>
            <View style={styles.odoBox}><Text style={styles.odoLabel}>Next Service</Text><Text style={styles.odoVal}>{Number((v.lastOilChangeOdometer || 0) + (v.oilChangeIntervalKm || 0)).toLocaleString()} km</Text></View>
          </View>
        </View>
      ))}

      <Text style={styles.section}>Recent Trips</Text>
      {trips.length === 0 && <Text style={styles.muted}>No trips logged yet.</Text>}
      {trips.slice(0, 20).map((t) => (
        <View key={t.id} style={styles.tripCard}>
          <View style={styles.tripRow}>
            <Text style={styles.tripRoute}>{t.startLabel || t.from || '—'} → {t.endLabel || t.to || '—'}</Text>
            <Text style={styles.tripKm}>{t.distanceKm ?? t.distance ?? 0} km</Text>
          </View>
          <Text style={styles.meta}>{fmtDate(t.createdAt || t.startedAt)}{t.status ? ` • ${t.status}` : ''}</Text>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted, marginHorizontal: 14, marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 14, marginBottom: 8 },
  alert: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold, borderWidth: 1, margin: 12, marginBottom: 0, padding: 12, borderRadius: 10 },
  alertText: { color: '#8A6D1A', fontWeight: '700' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.green },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.greenDark },
  plate: { fontSize: 13, fontWeight: '700', color: COLORS.gold },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  odoRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  odoBox: { flex: 1, backgroundColor: COLORS.greenPale, borderRadius: 10, padding: 10 },
  odoLabel: { fontSize: 11, color: COLORS.textMuted },
  odoVal: { fontSize: 15, fontWeight: '800', color: COLORS.greenDark, marginTop: 2 },
  tripCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tripRoute: { fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  tripKm: { fontWeight: '800', color: COLORS.green, marginLeft: 8 },
});
