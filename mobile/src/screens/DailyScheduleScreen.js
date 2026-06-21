import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const today = () => new Date().toISOString().slice(0, 10);

export default function DailyScheduleScreen() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d) => {
    setLoading(true);
    try { const r = await api.get('/reports/daily-schedule', { params: { date: d } }); setData(r.data); }
    catch { setData(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = setTimeout(() => { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) load(date); }, 300); return () => clearTimeout(t); }, [date, load]);

  const events = data?.events || [];
  const sum = data?.summary || {};

  return (
    <View style={st.root}>
      <View style={st.bar}>
        <Text style={st.label}>Date</Text>
        <TextInput style={st.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
      </View>
      <View style={st.cards}>
        <Stat n={sum.checkIns ?? 0} l="Check-ins" />
        <Stat n={sum.checkOuts ?? 0} l="Check-outs" />
        <Stat n={sum.transports ?? 0} l="Transports" />
      </View>
      {loading ? <ActivityIndicator color={COLORS.green} style={{ marginTop: 30 }} /> : (
        <FlatList data={events} keyExtractor={(_, i) => String(i)} contentContainerStyle={events.length === 0 && st.center}
          ListEmptyComponent={<Text style={st.muted}>No events for this date.</Text>}
          renderItem={({ item }) => (
            <View style={st.row}>
              <View style={[st.tag, { backgroundColor: item.eventType === 'CHECK-IN' ? COLORS.success : item.eventType === 'CHECK-OUT' ? COLORS.gold : '#4A90D9' }]}><Text style={st.tagTxt}>{item.eventType}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{item.customerName || '—'} {item.time ? `• ${item.time}` : ''}</Text>
                <Text style={st.meta}>{[item.bookingRef, item.hotelName, item.location, item.vehicle, item.route].filter(Boolean).join(' • ')}</Text>
              </View>
            </View>
          )} />
      )}
    </View>
  );
}

const Stat = ({ n, l }) => (<View style={st.stat}><Text style={st.statN}>{n}</Text><Text style={st.statL}>{l}</Text></View>);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' }, muted: { color: COLORS.textMuted },
  bar: { padding: 12 }, label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: COLORS.text },
  cards: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginBottom: 6 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '800', color: COLORS.greenDark }, statL: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 12, borderRadius: 10 },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }, tagTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  title: { fontWeight: '600', color: COLORS.text }, meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
