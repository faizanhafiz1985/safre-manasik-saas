import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

// Create or edit a booking. Itinerary line-items (hotel/transport trips) are
// managed on the web app; here we capture customer, package, dates, pax, amount.
export default function BookingFormScreen({ route, navigation }) {
  const editing = route.params?.booking || null;
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [picker, setPicker] = useState(null); // 'customer' | 'package' | null
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: editing?.customerId || editing?.customer?.id || '',
    customerName: editing?.customer?.name || '',
    packageId: editing?.packageId || editing?.package?.id || '',
    packageName: editing?.package?.name || '',
    travelDateFrom: editing?.travelDateFrom ? String(editing.travelDateFrom).slice(0, 10) : '',
    travelDateTo: editing?.travelDateTo ? String(editing.travelDateTo).slice(0, 10) : '',
    totalPax: editing?.totalPax ? String(editing.totalPax) : '1',
    totalAmount: editing?.totalAmount != null ? String(editing.totalAmount) : '',
    notes: editing?.notes || '',
  });

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit Booking' : 'New Booking' });
    api.get('/users/customers').then((r) => setCustomers(r.data.data || [])).catch(() => {});
    api.get('/packages').then((r) => setPackages(r.data.data || r.data || [])).catch(() => {});
  }, [editing, navigation]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.customerId) return Alert.alert('Required', 'Select a customer.');
    if (!form.travelDateFrom || !form.travelDateTo) return Alert.alert('Required', 'Enter departure and return dates (YYYY-MM-DD).');
    const payload = {
      customerId: form.customerId,
      packageId: form.packageId || undefined,
      travelDateFrom: form.travelDateFrom,
      travelDateTo: form.travelDateTo,
      totalPax: Number(form.totalPax) || 1,
      totalAmount: Number(form.totalAmount) || 0,
      notes: form.notes,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/bookings/${editing.id}`, payload);
      else await api.post('/bookings', { ...payload, passengers: [] });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.response?.data?.error || 'Could not save booking.');
    } finally { setSaving(false); }
  };

  const pickerData = picker === 'customer' ? customers : packages;

  return (
    <ScrollView style={styles.root} keyboardShouldPersistTaps="handled">
      <Label>Customer *</Label>
      <Selector text={form.customerName || 'Select customer'} onPress={() => setPicker('customer')} />

      <Label>Package (optional)</Label>
      <Selector text={form.packageName || 'None (ad-hoc booking)'} onPress={() => setPicker('package')}
        onClear={form.packageId ? () => set('packageId', '') || set('packageName', '') : null} />

      <View style={styles.rowTwo}>
        <View style={styles.half}><Label>Departure</Label>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={form.travelDateFrom} onChangeText={(v) => set('travelDateFrom', v)} /></View>
        <View style={styles.half}><Label>Return</Label>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={form.travelDateTo} onChangeText={(v) => set('travelDateTo', v)} /></View>
      </View>

      <View style={styles.rowTwo}>
        <View style={styles.half}><Label>Total Pax</Label>
          <TextInput style={styles.input} keyboardType="number-pad" value={form.totalPax} onChangeText={(v) => set('totalPax', v.replace(/[^0-9]/g, ''))} /></View>
        <View style={styles.half}><Label>Total Amount (SAR)</Label>
          <TextInput style={styles.input} keyboardType="decimal-pad" value={form.totalAmount} onChangeText={(v) => set('totalAmount', v.replace(/[^0-9.]/g, ''))} /></View>
      </View>

      <Label>Notes</Label>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline value={form.notes} onChangeText={(v) => set('notes', v)} />

      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{editing ? 'Save Changes' : 'Create Booking'}</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />

      <Modal visible={!!picker} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{picker === 'customer' ? 'Select Customer' : 'Select Package'}</Text>
            <TouchableOpacity onPress={() => setPicker(null)}><Text style={styles.close}>Close</Text></TouchableOpacity>
          </View>
          <FlatList
            data={pickerData}
            keyExtractor={(it) => it.id}
            ListEmptyComponent={<Text style={styles.muted}>Nothing to show.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickRow} onPress={() => {
                if (picker === 'customer') { set('customerId', item.id); set('customerName', item.name); }
                else { set('packageId', item.id); set('packageName', item.name); }
                setPicker(null);
              }}>
                <Text style={styles.pickName}>{item.name}</Text>
                {picker === 'customer' && item.email ? <Text style={styles.muted}>{item.email}</Text> : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;
const Selector = ({ text, onPress, onClear }) => (
  <View style={styles.selectorRow}>
    <TouchableOpacity style={styles.selector} onPress={onPress}><Text style={styles.selectorText}>{text}</Text></TouchableOpacity>
    {onClear ? <TouchableOpacity onPress={onClear} style={styles.clear}><Text style={{ color: COLORS.danger, fontWeight: '700' }}>✕</Text></TouchableOpacity> : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream, padding: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  selectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selector: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  selectorText: { color: COLORS.text },
  clear: { padding: 8 },
  rowTwo: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  submit: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.greenDark },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  close: { color: COLORS.gold, fontWeight: '700' },
  pickRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  muted: { color: COLORS.textMuted, padding: 16 },
});
