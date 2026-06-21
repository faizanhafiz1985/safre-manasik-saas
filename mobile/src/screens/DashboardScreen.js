import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/dashboard/stats'); setData(r.data); }
    catch { /* surfaced as empty */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  const s = data?.stats || {};
  const cards = [
    { label: 'Bookings', value: s.totalBookings ?? 0 },
    { label: 'Confirmed', value: s.confirmedBookings ?? s.confirmed ?? 0 },
    { label: 'Customers', value: s.totalCustomers ?? 0 },
    { label: 'Packages', value: s.totalPackages ?? 0 },
    { label: 'Revenue', value: `SAR ${Number(s.totalRevenue ?? 0).toLocaleString()}`, wide: true },
  ];
  const recent = data?.recentBookings || [];

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={styles.hi}>Welcome, {user?.name?.split(' ')[0] || ''}</Text>
      <View style={styles.grid}>
        {cards.map((c) => (
          <View key={c.label} style={[styles.card, c.wide && styles.wide]}>
            <Text style={styles.cardVal}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Recent Bookings</Text>
      {recent.length === 0 && <Text style={styles.muted}>No recent bookings.</Text>}
      {recent.map((b) => (
        <View key={b.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{b.bookingRef} — {b.customer?.name || '—'}</Text>
            <Text style={styles.muted}>{b.package?.name || 'Ad-hoc'} • {fmtDate(b.travelDateFrom)}</Text>
          </View>
          <Text style={styles.rowAmt}>SAR {Number(b.totalAmount || 0).toLocaleString()}</Text>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  hi: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, margin: 14, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  card: { width: '46%', backgroundColor: '#fff', borderRadius: 12, padding: 16, margin: '2%', borderLeftWidth: 4, borderLeftColor: COLORS.green },
  wide: { width: '96%', borderLeftColor: COLORS.gold },
  cardVal: { fontSize: 22, fontWeight: '800', color: COLORS.greenDark },
  cardLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 14, marginBottom: 8 },
  muted: { color: COLORS.textMuted, marginHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
  rowTitle: { fontWeight: '600', color: COLORS.text },
  rowAmt: { fontWeight: '800', color: COLORS.green, marginLeft: 8 },
});
