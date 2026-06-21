import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
const nights = (a, b) => { if (!dateOk(a) || !dateOk(b)) return 0; const d = Math.round((new Date(b) - new Date(a)) / 86400000); return d > 0 ? d : 0; };
const EMPTY_H = { hotelName: '', checkInDate: '', checkOutDate: '', rooms: '1', perNightPrice: '' };
const EMPTY_T = { vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', price: '' };

export default function BookingFormScreen({ route, navigation }) {
  const editing = route.params?.booking || null;
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hotelTrips, setHotelTrips] = useState(editing?.hotelTrips?.map((t) => ({ hotelName: t.hotelName || '', checkInDate: (t.checkInDate || '').slice(0, 10), checkOutDate: (t.checkOutDate || '').slice(0, 10), rooms: String(t.rooms || 1), perNightPrice: t.perNightPrice != null ? String(t.perNightPrice) : '' })) || []);
  const [transportTrips, setTransportTrips] = useState(editing?.transportTrips?.map((t) => ({ vehicleType: t.vehicleType || '', pickupLocation: t.pickupLocation || '', dropoffLocation: t.dropoffLocation || '', travelDate: (t.travelDate || '').slice(0, 10), price: t.price != null ? String(t.price) : '' })) || []);
  const [form, setForm] = useState({
    customerId: editing?.customerId || editing?.customer?.id || '', customerName: editing?.customer?.name || '',
    packageId: editing?.packageId || editing?.package?.id || '', packageName: editing?.package?.name || '',
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
  const hasTrips = hotelTrips.length > 0 || transportTrips.length > 0;
  const tripsTotal = hotelTrips.reduce((s, t) => s + Math.max(1, Number(t.rooms || 1)) * nights(t.checkInDate, t.checkOutDate) * Number(t.perNightPrice || 0), 0)
    + transportTrips.reduce((s, t) => s + Number(t.price || 0), 0);

  const submit = async () => {
    if (!form.customerId) return Alert.alert('Required', 'Select a customer.');
    if (!dateOk(form.travelDateFrom) || !dateOk(form.travelDateTo)) return Alert.alert('Invalid dates', 'Enter departure and return as YYYY-MM-DD.');
    if (form.travelDateTo < form.travelDateFrom) return Alert.alert('Invalid dates', 'Return cannot be before departure.');
    const payload = {
      customerId: form.customerId, packageId: form.packageId || undefined,
      travelDateFrom: form.travelDateFrom, travelDateTo: form.travelDateTo,
      totalPax: Number(form.totalPax) || 1,
      totalAmount: hasTrips ? tripsTotal : (Number(form.totalAmount) || 0),
      notes: form.notes,
      hotelTrips, transportTrips,
    };
    setSaving(true);
    try {
      if (editing) await api.put(`/bookings/${editing.id}`, payload);
      else await api.post('/bookings', { ...payload, passengers: [] });
      navigation.goBack();
    } catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save booking.'); }
    finally { setSaving(false); }
  };

  const updH = (i, k, v) => setHotelTrips((a) => a.map((t, x) => x === i ? { ...t, [k]: v } : t));
  const updT = (i, k, v) => setTransportTrips((a) => a.map((t, x) => x === i ? { ...t, [k]: v } : t));
  const pickerData = picker === 'customer' ? customers : packages;

  return (
    <ScrollView style={styles.root} keyboardShouldPersistTaps="handled">
      <Label>Customer *</Label>
      <Sel text={form.customerName || 'Select customer'} onPress={() => setPicker('customer')} />
      <Label>Package (optional)</Label>
      <Sel text={form.packageName || 'None (ad-hoc)'} onPress={() => setPicker('package')} onClear={form.packageId ? () => setForm((f) => ({ ...f, packageId: '', packageName: '' })) : null} />

      <View style={styles.two}>
        <View style={styles.half}><Label>Departure</Label><Inp ph="YYYY-MM-DD" v={form.travelDateFrom} on={(v) => set('travelDateFrom', v)} /></View>
        <View style={styles.half}><Label>Return</Label><Inp ph="YYYY-MM-DD" v={form.travelDateTo} on={(v) => set('travelDateTo', v)} /></View>
      </View>
      <View style={styles.two}>
        <View style={styles.half}><Label>Total Pax</Label><Inp kb="number-pad" v={form.totalPax} on={(v) => set('totalPax', v.replace(/[^0-9]/g, ''))} /></View>
        <View style={styles.half}><Label>Total Amount (SAR)</Label><Inp kb="decimal-pad" editable={!hasTrips} v={hasTrips ? String(tripsTotal) : form.totalAmount} on={(v) => set('totalAmount', v.replace(/[^0-9.]/g, ''))} /></View>
      </View>
      {hasTrips ? <Text style={styles.autonote}>Total auto-calculated from itinerary.</Text> : null}

      {/* Hotel trips */}
      <Row2 title={`Hotel Trips (${hotelTrips.length})`} onAdd={() => setHotelTrips((a) => [...a, { ...EMPTY_H }])} />
      {hotelTrips.map((t, i) => (
        <View key={i} style={styles.trip}>
          <Removable onRemove={() => setHotelTrips((a) => a.filter((_, x) => x !== i))} label={`Hotel ${i + 1}`} />
          <Inp ph="Hotel name" v={t.hotelName} on={(v) => updH(i, 'hotelName', v)} />
          <View style={styles.two}><View style={styles.half}><Inp ph="Check-in YYYY-MM-DD" v={t.checkInDate} on={(v) => updH(i, 'checkInDate', v)} /></View><View style={styles.half}><Inp ph="Check-out" v={t.checkOutDate} on={(v) => updH(i, 'checkOutDate', v)} /></View></View>
          <View style={styles.two}><View style={styles.half}><Inp ph="Rooms" kb="number-pad" v={t.rooms} on={(v) => updH(i, 'rooms', v.replace(/[^0-9]/g, ''))} /></View><View style={styles.half}><Inp ph="Per-night SAR" kb="decimal-pad" v={t.perNightPrice} on={(v) => updH(i, 'perNightPrice', v.replace(/[^0-9.]/g, ''))} /></View></View>
        </View>
      ))}

      {/* Transport trips */}
      <Row2 title={`Transport Trips (${transportTrips.length})`} onAdd={() => setTransportTrips((a) => [...a, { ...EMPTY_T }])} />
      {transportTrips.map((t, i) => (
        <View key={i} style={styles.trip}>
          <Removable onRemove={() => setTransportTrips((a) => a.filter((_, x) => x !== i))} label={`Transport ${i + 1}`} />
          <Inp ph="Vehicle type" v={t.vehicleType} on={(v) => updT(i, 'vehicleType', v)} />
          <View style={styles.two}><View style={styles.half}><Inp ph="Pickup" v={t.pickupLocation} on={(v) => updT(i, 'pickupLocation', v)} /></View><View style={styles.half}><Inp ph="Drop-off" v={t.dropoffLocation} on={(v) => updT(i, 'dropoffLocation', v)} /></View></View>
          <View style={styles.two}><View style={styles.half}><Inp ph="Travel date YYYY-MM-DD" v={t.travelDate} on={(v) => updT(i, 'travelDate', v)} /></View><View style={styles.half}><Inp ph="Price SAR" kb="decimal-pad" v={t.price} on={(v) => updT(i, 'price', v.replace(/[^0-9.]/g, ''))} /></View></View>
        </View>
      ))}

      <Label>Notes</Label>
      <Inp v={form.notes} on={(v) => set('notes', v)} multiline />

      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>{editing ? 'Save Changes' : 'Create Booking'}</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />

      <Modal visible={!!picker} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}><Text style={styles.modalTitle}>{picker === 'customer' ? 'Select Customer' : 'Select Package'}</Text><TouchableOpacity onPress={() => setPicker(null)}><Text style={styles.close}>Close</Text></TouchableOpacity></View>
          <FlatList data={pickerData} keyExtractor={(it) => it.id} ListEmptyComponent={<Text style={styles.muted}>Nothing to show.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickRow} onPress={() => { if (picker === 'customer') setForm((f) => ({ ...f, customerId: item.id, customerName: item.name })); else setForm((f) => ({ ...f, packageId: item.id, packageName: item.name })); setPicker(null); }}>
                <Text style={styles.pickName}>{item.name}</Text>
                {picker === 'customer' && item.email ? <Text style={styles.muted}>{item.email}</Text> : null}
              </TouchableOpacity>
            )} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const Label = ({ children }) => <Text style={styles.label}>{children}</Text>;
const Inp = ({ ph, v, on, kb, editable = true, multiline }) => (
  <TextInput style={[styles.input, !editable && styles.disabled, multiline && { height: 70, textAlignVertical: 'top' }]} placeholder={ph} placeholderTextColor="#9CA3AF" value={v} onChangeText={on} keyboardType={kb || 'default'} editable={editable} multiline={multiline} />
);
const Sel = ({ text, onPress, onClear }) => (
  <View style={styles.selRow}>
    <TouchableOpacity style={styles.sel} onPress={onPress}><Text style={styles.selTxt}>{text}</Text></TouchableOpacity>
    {onClear ? <TouchableOpacity onPress={onClear} style={styles.clear}><Text style={{ color: COLORS.danger, fontWeight: '700' }}>✕</Text></TouchableOpacity> : null}
  </View>
);
const Row2 = ({ title, onAdd }) => (
  <View style={styles.secRow}><Text style={styles.sec}>{title}</Text><TouchableOpacity onPress={onAdd} style={styles.addBtn}><Text style={styles.addTxt}>＋ Add</Text></TouchableOpacity></View>
);
const Removable = ({ label, onRemove }) => (
  <View style={styles.tripHead}><Text style={styles.tripLabel}>{label}</Text><TouchableOpacity onPress={onRemove}><Text style={{ color: COLORS.danger, fontWeight: '700' }}>Remove</Text></TouchableOpacity></View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream, padding: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff', marginBottom: 8 },
  disabled: { backgroundColor: '#F1F5F9', color: '#9CA3AF' },
  two: { flexDirection: 'row', gap: 10 }, half: { flex: 1 },
  selRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: '#fff' }, selTxt: { color: COLORS.text }, clear: { padding: 8 },
  autonote: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6 },
  sec: { fontSize: 12, fontWeight: '700', color: COLORS.green, textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }, addTxt: { color: COLORS.green, fontWeight: '700' },
  trip: { backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  tripHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, tripLabel: { fontWeight: '700', color: COLORS.greenDark },
  submit: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 }, submitTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.greenDark }, modalTitle: { color: '#fff', fontWeight: '800', fontSize: 16 }, close: { color: COLORS.gold, fontWeight: '700' },
  pickRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }, pickName: { fontSize: 15, fontWeight: '600', color: COLORS.text }, muted: { color: COLORS.textMuted, padding: 16 },
});
