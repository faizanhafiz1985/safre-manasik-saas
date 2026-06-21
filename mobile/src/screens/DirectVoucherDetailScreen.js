import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const STATUS_COLOR = { CONFIRMED: COLORS.success, TENTATIVE: COLORS.gold, CANCELLED: COLORS.danger };
const METHODS = ['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'CHEQUE'];

export default function DirectVoucherDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { can } = useAuth();
  const [v, setV] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('CASH');

  const load = useCallback(async () => {
    try { const r = await api.get(`/voucher-forms/${id}`); setV(r.data); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) Alert.alert('Done', okMsg); load(); }
    catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Action failed'); }
    finally { setBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;
  if (!v) return <View style={styles.center}><Text style={styles.muted}>Not found</Text></View>;

  const trips = Array.isArray(v.trips) ? v.trips : [];
  const canEdit = can('voucher_forms', 'edit');

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.head}>
        <Text style={styles.no}>{v.voucherNo}</Text>
        <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[v.status] || COLORS.textMuted }]}>{v.status}</Text>
      </View>
      <Text style={styles.sub}>{v.type === 'HOTEL' ? '🏨 Hotel Voucher' : '🚐 Transport Voucher'} • {v.paymentStatus || 'UNPAID'}</Text>

      <Card title="Customer">
        <Row label="Name" value={`${v.firstName || ''} ${v.lastName || ''}`.trim()} />
        {v.companyName ? <Row label="Company" value={v.companyName} /> : null}
        <Row label="Mobile" value={v.mobile} />
        <Row label="Passport" value={v.passport} />
        {v.hcn ? <Row label="HCN #" value={v.hcn} /> : null}
        <Row label="Total" value={`SAR ${Number(v.totalValue || 0).toLocaleString()}`} />
      </Card>

      {trips.length > 0 && (
        <Card title={v.type === 'HOTEL' ? 'Hotel Details' : 'Transport Details'}>
          {trips.map((t, i) => (
            <View key={i} style={styles.trip}>
              {v.type === 'HOTEL'
                ? <><Text style={styles.tripTitle}>{t.hotelName}</Text><Text style={styles.muted}>{t.checkInDate} → {t.checkOutDate} • {t.rooms || 1} rm{t.roomType ? ` • ${t.roomType}` : ''}</Text></>
                : <><Text style={styles.tripTitle}>{t.vehicleType}</Text><Text style={styles.muted}>{t.pickupLocation} → {t.dropoffLocation} • {t.travelDate}</Text></>}
            </View>
          ))}
        </Card>
      )}

      <View style={{ padding: 12 }}>
        <Text style={styles.section}>Documents</Text>
        <Btn outline label="View Voucher" onPress={() => navigation.navigate('PrintWebView', { path: `/voucher-forms/${id}/print`, title: v.voucherNo })} />
        <Btn outline label="Proforma Invoice" style={{ marginTop: 10 }} onPress={() => navigation.navigate('PrintWebView', { path: `/voucher-forms/${id}/invoice/PROFORMA/print`, title: 'Proforma' })} />
        {v.status === 'CONFIRMED' && <Btn outline label="Tax Invoice" style={{ marginTop: 10 }} onPress={() => navigation.navigate('PrintWebView', { path: `/voucher-forms/${id}/invoice/ACTUAL/print`, title: 'Tax Invoice' })} />}

        {canEdit && v.status !== 'CANCELLED' && (
          <>
            <Text style={[styles.section, { marginTop: 18 }]}>Actions</Text>
            {v.status === 'CONFIRMED' && v.paymentStatus !== 'PAID' && <Btn label="Record Payment" onPress={() => setPayOpen(true)} />}
            {v.status === 'TENTATIVE' && <Btn label="Confirm Voucher" style={{ marginTop: 10 }} disabled={busy} onPress={() => act(() => api.patch(`/voucher-forms/${id}/confirm`), 'Voucher confirmed')} />}
            <Btn outline danger label="Cancel Voucher" style={{ marginTop: 10 }} disabled={busy}
              onPress={() => Alert.alert('Cancel voucher?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: () => act(() => api.patch(`/voucher-forms/${id}/cancel`), 'Voucher cancelled') }])} />
          </>
        )}
      </View>
      <View style={{ height: 24 }} />

      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <View style={styles.modalRoot}><View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Record Payment</Text>
          <Text style={styles.payNote}>Marks this voucher as fully paid.</Text>
          <Text style={styles.label}>Method</Text>
          <View style={styles.methods}>
            {METHODS.map((m) => <TouchableOpacity key={m} style={[styles.method, method === m && styles.methodOn]} onPress={() => setMethod(m)}><Text style={[styles.methodTxt, method === m && { color: '#fff' }]}>{m.replace('_', ' ')}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.label}>Reference (optional)</Text>
          <TextInput style={styles.input} value={reference} onChangeText={setReference} />
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => setPayOpen(false)} style={styles.cancel}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.save} disabled={busy}
              onPress={() => act(async () => { await api.patch(`/voucher-forms/${id}/payment`, { method, reference: reference || undefined }); setPayOpen(false); }, 'Payment recorded')}>
              <Text style={styles.saveTxt}>{busy ? '…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const Card = ({ title, children }) => (<View style={styles.cardWrap}><Text style={styles.section}>{title}</Text><View style={styles.card}>{children}</View></View>);
const Row = ({ label, value }) => (<View style={styles.rowItem}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowVal}>{value || '—'}</Text></View>);
const Btn = ({ label, onPress, outline, danger, disabled, style }) => (
  <TouchableOpacity disabled={disabled} onPress={onPress}
    style={[outline ? styles.btnOutline : styles.btn, danger && { borderColor: COLORS.danger }, disabled && { opacity: 0.5 }, style]}>
    <Text style={outline ? [styles.btnOutlineTxt, danger && { color: COLORS.danger }] : styles.btnTxt}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingBottom: 2 },
  no: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark },
  badge: { color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  sub: { color: COLORS.textMuted, marginLeft: 14, marginBottom: 6 },
  cardWrap: { paddingHorizontal: 12 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginVertical: 8, marginLeft: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 6 },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.textMuted, fontWeight: '600' }, rowVal: { color: COLORS.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  trip: { paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tripTitle: { fontWeight: '600', color: COLORS.text },
  btn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOutlineTxt: { color: COLORS.green, fontWeight: '700' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, marginBottom: 4 },
  payNote: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  methodOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  methodTxt: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancel: { paddingVertical: 12, paddingHorizontal: 18 }, cancelTxt: { color: COLORS.textMuted, fontWeight: '700' },
  save: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 }, saveTxt: { color: '#fff', fontWeight: '700' },
});
