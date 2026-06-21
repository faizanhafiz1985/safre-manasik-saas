import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const STATUS_COLOR = { CONFIRMED: COLORS.success, TENTATIVE: COLORS.gold, CANCELLED: COLORS.danger };

export default function BookingsScreen({ navigation }) {
  const { isStaff } = useAuth();
  useLayoutEffect(() => {
    if (isStaff) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('BookingForm', {})} style={{ paddingHorizontal: 12 }}>
            <Text style={{ color: COLORS.gold, fontWeight: '700', fontSize: 15 }}>＋ New</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, isStaff]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/bookings', { params: { limit: 50 } });
      setItems(data.data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load bookings');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <FlatList
      style={styles.root}
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={items.length === 0 && styles.center}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.muted}>{error || 'No bookings yet.'}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('BookingDetail', { id: item.id })}>
          <View style={styles.row}>
            <Text style={styles.ref}>{item.bookingRef}</Text>
            <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] || COLORS.textMuted }]}>{item.status}</Text>
          </View>
          <Text style={styles.name}>{item.customer?.name || '—'}</Text>
          <Text style={styles.meta}>{item.package?.name || 'Ad-hoc'} • {item.totalPax} pax</Text>
          <Text style={styles.amount}>{item.currency || 'SAR'} {Number(item.totalAmount || 0).toLocaleString()}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', margin: 10, marginBottom: 0, padding: 16, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 13, fontWeight: '700', color: COLORS.greenDark },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 6 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700', color: COLORS.green, marginTop: 8 },
  muted: { color: COLORS.textMuted },
});
