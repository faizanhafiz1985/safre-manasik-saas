import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Modal,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const METHODS = ['CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'CHEQUE'];
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function PaymentsScreen({ route }) {
  const { id } = route.params;
  const { isStaff } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const inv = await api.get(`/payments/invoice/${id}`).then((r) => r.data).catch(() => null);
      setInvoice(inv);
      const pays = await api.get('/payments', { params: { bookingId: id } }).then((r) => r.data).catch(() => []);
      setPayments(Array.isArray(pays) ? pays : (pays.data || []));
    } finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const record = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return Alert.alert('Invalid', 'Enter a positive amount.');
    setSaving(true);
    try {
      await api.post('/payments', { bookingId: id, amount: amt, method, reference });
      setOpen(false); setAmount(''); setReference(''); setMethod('CASH'); load();
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.error || 'Could not record payment.');
    } finally { setSaving(false); }
  };

  const payOnline = async () => {
    // Hand off to the web app's online-payment flow (PayPal/Moyasar/Apple Pay).
    await WebBrowser.openBrowserAsync(`https://app.safremanasik.com/bookings/${id}`);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  const total = Number(invoice?.totalAmount || 0);
  const paid = Number(invoice?.paidAmount || 0);
  const balance = Number(invoice?.balance != null ? invoice.balance : total - paid);

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.summary}>
        <Text style={styles.sumTitle}>Invoice</Text>
        <Line label="Total" value={total} />
        <Line label="Paid" value={paid} />
        <Line label="Balance" value={balance} bold />
        {invoice?.status ? <Text style={styles.statusPill}>{invoice.status}</Text> : <Text style={styles.muted}>No invoice generated yet.</Text>}
      </View>

      <View style={styles.btnRow}>
        {isStaff && <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}><Text style={styles.btnText}>Record Payment</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.btnOutline} onPress={payOnline}><Text style={styles.btnOutlineText}>Pay Online</Text></TouchableOpacity>
      </View>
      <Text style={styles.note}>Online payment (PayPal / Mada / Apple Pay) opens your tenant's secure web checkout.</Text>

      <Text style={styles.section}>Payment History</Text>
      {payments.length === 0 && <Text style={styles.muted}>No payments recorded.</Text>}
      {payments.map((p) => (
        <View key={p.id} style={styles.payCard}>
          <View style={styles.payRow}>
            <Text style={styles.payAmt}>{p.currency || 'SAR'} {Number(p.amount).toLocaleString()}</Text>
            <Text style={styles.payMethod}>{p.method}</Text>
          </View>
          <Text style={styles.muted}>{fmtDate(p.paidAt)}{p.reference ? ` • ${p.reference}` : ''}</Text>
        </View>
      ))}
      <View style={{ height: 24 }} />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Record Payment</Text>
            <Text style={styles.label}>Amount (SAR)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} />
            <Text style={styles.label}>Method</Text>
            <View style={styles.methods}>
              {METHODS.map((m) => (
                <TouchableOpacity key={m} style={[styles.method, method === m && styles.methodActive]} onPress={() => setMethod(m)}>
                  <Text style={[styles.methodText, method === m && { color: '#fff' }]}>{m.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Reference (optional)</Text>
            <TextInput style={styles.input} value={reference} onChangeText={setReference} />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={record} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}><Text style={styles.saveText}>{saving ? '…' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const Line = ({ label, value, bold }) => (
  <View style={styles.line}>
    <Text style={[styles.lineLabel, bold && { fontWeight: '800', color: COLORS.greenDark }]}>{label}</Text>
    <Text style={[styles.lineVal, bold && { fontWeight: '800', color: COLORS.green }]}>SAR {Number(value).toLocaleString()}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted, marginHorizontal: 14 },
  summary: { backgroundColor: '#fff', margin: 12, padding: 16, borderRadius: 12 },
  sumTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { color: COLORS.textMuted, fontWeight: '600' },
  lineVal: { color: COLORS.text, fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: COLORS.greenPale, color: COLORS.green, fontWeight: '700', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  btnRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12 },
  btn: { flex: 1, backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutline: { flex: 1, borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOutlineText: { color: COLORS.green, fontWeight: '700' },
  note: { fontSize: 11, color: COLORS.textMuted, margin: 12, marginTop: 8 },
  section: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: 14, marginBottom: 8 },
  payCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 12, borderRadius: 10 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between' },
  payAmt: { fontWeight: '800', color: COLORS.green },
  payMethod: { color: COLORS.textMuted, fontWeight: '600', fontSize: 12 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  methodActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  methodText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancel: { paddingVertical: 12, paddingHorizontal: 18 },
  cancelText: { color: COLORS.textMuted, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  saveText: { color: '#fff', fontWeight: '700' },
});
