import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

export default function PackagesScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/packages');
      setItems(data.data || data || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load packages');
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
      ListEmptyComponent={<Text style={styles.muted}>{error || 'No packages available.'}</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.meta}>{item.durationDays} days{item.visaIncluded ? ' • Visa' : ''}{item.transportIncluded ? ' • Transport' : ''}{item.cateringIncluded ? ' • Catering' : ''}</Text>
          {item.description ? <Text style={styles.desc} numberOfLines={2}>{item.description}</Text> : null}
          {Array.isArray(item.priceTiers) && item.priceTiers[0] ? (
            <Text style={styles.price}>From SAR {Number(item.priceTiers[0].pricePerPax).toLocaleString()} / pax</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', margin: 10, marginBottom: 0, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.gold },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.greenDark },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  desc: { fontSize: 13, color: COLORS.text, marginTop: 8 },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.green, marginTop: 10 },
  muted: { color: COLORS.textMuted },
});
