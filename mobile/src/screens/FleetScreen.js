import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { COLORS } from '../theme';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

export default function FleetScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null); // 'trip' | 'cash'
  const [busy, setBusy] = useState(false);
  const [trip, setTrip] = useState({ startLabel: '', endLabel: '', distanceKm: '' });
  const [cash, setCash] = useState({ amount: '', notes: '' });

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
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const vehicleId = vehicles[0]?.id;

  const saveTrip = async () => {
    if (!vehicleId) return Alert.alert('No vehicle', 'No vehicle assigned.');
    if (!trip.startLabel.trim() || !trip.endLabel.trim()) return Alert.alert('Required', 'From and To are required.');
    if (!(Number(trip.distanceKm) > 0)) return Alert.alert('Required', 'Distance must be greater than 0 km.');
    setBusy(true);
    try {
      await api.post('/fleet/trips', { vehicleId, startLabel: trip.startLabel, endLabel: trip.endLabel, distanceKm: Number(trip.distanceKm) });
      setModal(null); setTrip({ startLabel: '', endLabel: '', distanceKm: '' }); load();
    } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not log trip.'); }
    finally { setBusy(false); }
  };

  const saveCash = async () => {
    if (!(Number(cash.amount) >= 0) || cash.amount === '') return Alert.alert('Required', 'Enter a valid amount.');
    setBusy(true);
    try {
      await api.post('/fleet/cash', { vehicleId: vehicleId || undefined, amount: Number(cash.amount), notes: cash.notes || undefined });
      setModal(null); setCash({ amount: '', notes: '' }); load();
    } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not submit cash.'); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {alerts.length > 0 && (
        <View style={styles.alert}><Text style={styles.alertText}>⚠️ {alerts.length} maintenance alert{alerts.length > 1 ? 's' : ''} — service due soon.</Text></View>
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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={() => setModal('trip')}><Text style={styles.btnTxt}>Log Trip</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => setModal('cash')}><Text style={styles.btnOutlineTxt}>Submit Cash</Text></TouchableOpacity>
      </View>

      <Text style={styles.section}>Recent Trips</Text>
      {trips.length === 0 && <Text style={styles.muted}>No trips logged yet.</Text>}
      {trips.slice(0, 20).map((t) => (
        <View key={t.id} style={styles.tripCard}>
          <View style={styles.tripRow}>
            <Text style={styles.tripRoute}>{t.startLabel || '—'} → {t.endLabel || '—'}</Text>
            <Text style={styles.tripKm}>{t.distanceKm ?? 0} km</Text>
          </View>
          <Text style={styles.meta}>{fmtDate(t.createdAt)}{t.status ? ` • ${t.status}` : ''}</Text>
        </View>
      ))}
      <View style={{ height: 24 }} />

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalRoot}><View style={styles.sheet}>
          {modal === 'trip' ? (
            <>
              <Text style={styles.sheetTitle}>Log Trip</Text>
              <Lbl>From</Lbl><Inp v={trip.startLabel} on={(v) => setTrip({ ...trip, startLabel: v })} />
              <Lbl>To</Lbl><Inp v={trip.endLabel} on={(v) => setTrip({ ...trip, endLabel: v })} />
              <Lbl>Distance (km)</Lbl><Inp v={trip.distanceKm} kb="decimal-pad" on={(v) => setTrip({ ...trip, distanceKm: v.replace(/[^0-9.]/g, '') })} />
              <Acts busy={busy} onCancel={() => setModal(null)} onSave={saveTrip} />
            </>
          ) : (
            <>
              <Text style={styles.sheetTitle}>Submit Cash</Text>
              <Lbl>Amount (SAR)</Lbl><Inp v={cash.amount} kb="decimal-pad" on={(v) => setCash({ ...cash, amount: v.replace(/[^0-9.]/g, '') })} />
              <Lbl>Notes (optional)</Lbl><Inp v={cash.notes} on={(v) => setCash({ ...cash, notes: v })} />
              <Acts busy={busy} onCancel={() => setModal(null)} onSave={saveCash} />
            </>
          )}
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const Lbl = ({ children }) => <Text style={styles.label}>{children}</Text>;
const Inp = ({ v, on, kb }) => <TextInput style={styles.input} value={v} onChangeText={on} keyboardType={kb || 'default'} />;
const Acts = ({ busy, onCancel, onSave }) => (
  <View style={styles.modalActions}>
    <TouchableOpacity onPress={onCancel} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
    <TouchableOpacity onPress={onSave} style={[styles.save, busy && { opacity: 0.6 }]} disabled={busy}><Text style={styles.saveTxt}>{busy ? '…' : 'Save'}</Text></TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted, marginHorizontal: 14, marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 14, marginBottom: 8 },
  alert: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold, borderWidth: 1, margin: 12, marginBottom: 0, padding: 12, borderRadius: 10 },
  alertText: { color: '#8A6D1A', fontWeight: '700' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.green },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.greenDark }, plate: { fontSize: 13, fontWeight: '700', color: COLORS.gold },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  odoRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  odoBox: { flex: 1, backgroundColor: COLORS.greenPale, borderRadius: 10, padding: 10 },
  odoLabel: { fontSize: 11, color: COLORS.textMuted }, odoVal: { fontSize: 15, fontWeight: '800', color: COLORS.greenDark, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginTop: 12 },
  btn: { flex: 1, backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  btnOutline: { flex: 1, borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOutlineTxt: { color: COLORS.green, fontWeight: '700' },
  tripCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between' },
  tripRoute: { fontWeight: '600', color: COLORS.text, flexShrink: 1 }, tripKm: { fontWeight: '800', color: COLORS.green, marginLeft: 8 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancel: { paddingVertical: 12, paddingHorizontal: 18 }, cancelTxt: { color: COLORS.textMuted, fontWeight: '700' },
  save: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 }, saveTxt: { color: '#fff', fontWeight: '700' },
});
