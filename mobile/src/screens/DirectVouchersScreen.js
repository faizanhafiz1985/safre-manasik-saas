import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const STATUS_COLOR = { CONFIRMED: COLORS.success, TENTATIVE: COLORS.gold, CANCELLED: COLORS.danger };

export default function DirectVouchersScreen({ navigation }) {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    if (can('voucher_forms', 'create')) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={() => navigation.navigate('DirectVoucherForm')} style={{ paddingHorizontal: 12 }}>
            <Text style={{ color: COLORS.gold, fontWeight: '700', fontSize: 15 }}>＋ New</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, can]);

  const load = useCallback(async () => {
    try { const r = await api.get('/voucher-forms'); setItems(Array.isArray(r.data) ? r.data : (r.data.data || [])); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <FlatList
      style={styles.root}
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={items.length === 0 && styles.center}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.muted}>No direct vouchers yet.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DirectVoucherDetail', { id: item.id })}>
          <View style={styles.row}>
            <Text style={styles.no}>{item.voucherNo}</Text>
            <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] || COLORS.textMuted }]}>{item.status}</Text>
          </View>
          <Text style={styles.name}>{item.companyName || `${item.firstName || ''} ${item.lastName || ''}`.trim()}</Text>
          <Text style={styles.meta}>{item.type === 'HOTEL' ? '🏨 Hotel' : '🚐 Transport'} • SAR {Number(item.totalValue || 0).toLocaleString()} • {item.paymentStatus || 'UNPAID'}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: COLORS.textMuted },
  card: { backgroundColor: '#fff', margin: 10, marginBottom: 0, padding: 14, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  no: { fontSize: 13, fontWeight: '700', color: COLORS.greenDark },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 6 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
