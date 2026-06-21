import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const today = () => new Date().toISOString().slice(0, 10);
const Stat = ({ n, l }) => (<View style={st.stat}><Text style={st.statN}>{n}</Text><Text style={st.statL}>{l}</Text></View>);

export default function TransportReportScreen() {
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s, e) => {
    setLoading(true);
    try { const r = await api.get('/reports/transport-by-date', { params: { startDate: s, endDate: e } }); setData(r.data); }
    catch { setData(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => { if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) load(start, end); }, 350); return () => clearTimeout(t); }, [start, end, load]);

  const rows = data?.events || data?.runs || [];

  return (
    <View style={st.root}>
      <View style={st.bar}>
        <View style={st.half}><Text style={st.label}>From</Text><TextInput style={st.input} value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" /></View>
        <View style={st.half}><Text style={st.label}>To</Text><TextInput style={st.input} value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" /></View>
      </View>
      {data ? (
        <View style={st.cards}>
          <Stat n={data.totalRuns ?? rows.length} l="Runs" />
          <Stat n={data.totalPassengers ?? 0} l="Passengers" />
          <Stat n={`${data.avgOccupancyPct ?? 0}%`} l="Avg Occupancy" />
        </View>
      ) : null}
      {loading ? <ActivityIndicator color={COLORS.green} style={{ marginTop: 30 }} /> : (
        <FlatList data={rows} keyExtractor={(_, i) => String(i)} contentContainerStyle={rows.length === 0 && st.center}
          ListEmptyComponent={<Text style={st.muted}>No transport runs in this range.</Text>}
          renderItem={({ item }) => (
            <View style={st.row}>
              <Text style={st.title}>{item.vehicleName || 'Vehicle'}{item.vehiclePlate ? ` • ${item.vehiclePlate}` : ''}</Text>
              <Text style={st.meta}>{item.routeFrom || '—'} → {item.routeTo || '—'} • {item.passengerCount || 0} pax • {item.occupancyPct || 0}%</Text>
              <Text style={st.sub}>{item.runDate || ''}{item.departureTime ? ` • ${item.departureTime}` : ''}{item.bookingRefs ? ` • ${item.bookingRefs}` : ''}</Text>
            </View>
          )} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, muted: { color: COLORS.textMuted },
  bar: { flexDirection: 'row', gap: 10, padding: 12 }, half: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: COLORS.text },
  row: { backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 12, borderRadius: 10 },
  title: { fontWeight: '700', color: COLORS.greenDark }, meta: { fontSize: 12, color: COLORS.text, marginTop: 3 },
  sub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cards: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginBottom: 6 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statN: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark }, statL: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});
