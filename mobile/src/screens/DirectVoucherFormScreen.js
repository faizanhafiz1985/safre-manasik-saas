import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const ROOM_TYPES = ['Sharing', 'Double', 'Triple', 'Quad', 'Quint'];
const DEFAULT_VEHICLE_TYPES = ['Sedan', 'SUV (GMC)', 'Van (Hiace)', 'Coaster', 'Bus (50-seater)', 'VIP'];
const D12 = /^\d{12}$/;
const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export default function DirectVoucherFormScreen({ navigation }) {
  const [type, setType] = useState('HOTEL');
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    firstName: '', lastName: '', mobile: '', whatsapp: '', passport: '', companyName: '',
    // hotel
    hotelName: '', checkInDate: '', checkOutDate: '', rooms: '1', roomType: 'Double', perNightPrice: '',
    // transport
    vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', price: '',
    passengerCount: '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const [vehicleTypes, setVehicleTypes] = useState(DEFAULT_VEHICLE_TYPES);
  useEffect(() => {
    // Configurable vehicle types from System Config → Fleet Settings (falls back to defaults).
    api.get('/config').then((r) => {
      const raw = (r.data?.vehicle_types || '').trim();
      const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
      setVehicleTypes(list.length ? Array.from(new Set(list)) : DEFAULT_VEHICLE_TYPES);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return Alert.alert('Required', 'First and last name are required.');
    if (!D12.test(f.mobile.replace(/\s/g, ''))) return Alert.alert('Invalid', 'Mobile must be 12 digits (e.g. 966501234567).');
    if (!f.passport.trim()) return Alert.alert('Required', 'Passport # is required.');
    let trip;
    if (type === 'HOTEL') {
      if (!f.hotelName.trim()) return Alert.alert('Required', 'Hotel name is required.');
      if (!dateOk(f.checkInDate) || !dateOk(f.checkOutDate)) return Alert.alert('Invalid', 'Check-in/out must be YYYY-MM-DD.');
      if (!(Number(f.perNightPrice) >= 0) || f.perNightPrice === '') return Alert.alert('Required', 'Per-night price is required.');
      trip = { hotelName: f.hotelName, checkInDate: f.checkInDate, checkOutDate: f.checkOutDate, rooms: Number(f.rooms) || 1, roomType: f.roomType, passengerCount: Number(f.passengerCount) || undefined, perNightPrice: Number(f.perNightPrice) };
    } else {
      if (!f.vehicleType.trim() || !f.pickupLocation.trim() || !f.dropoffLocation.trim()) return Alert.alert('Required', 'Vehicle, pickup and drop-off are required.');
      if (!dateOk(f.travelDate)) return Alert.alert('Invalid', 'Travel date must be YYYY-MM-DD.');
      if (f.price === '' || !(Number(f.price) >= 0)) return Alert.alert('Required', 'Price is required.');
      trip = { vehicleType: f.vehicleType, pickupLocation: f.pickupLocation, dropoffLocation: f.dropoffLocation, travelDate: f.travelDate, passengerCount: Number(f.passengerCount) || undefined, price: Number(f.price) };
    }
    setSaving(true);
    try {
      await api.post('/voucher-forms', {
        type, firstName: f.firstName, lastName: f.lastName, mobile: f.mobile.replace(/\s/g, ''),
        whatsapp: f.whatsapp ? f.whatsapp.replace(/\s/g, '') : undefined, passport: f.passport, companyName: f.companyName || undefined,
        trips: [trip],
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.response?.data?.error || 'Could not create voucher.');
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.root} keyboardShouldPersistTaps="handled">
      <View style={styles.toggle}>
        {['HOTEL', 'TRANSPORT'].map((t) => (
          <TouchableOpacity key={t} style={[styles.tog, type === t && styles.togOn]} onPress={() => setType(t)}>
            <Text style={[styles.togTxt, type === t && { color: '#fff' }]}>{t === 'HOTEL' ? '🏨 Hotel' : '🚐 Transport'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Sec>Customer</Sec>
      <Two><F label="First Name *" v={f.firstName} on={(v) => set('firstName', v)} /><F label="Last Name *" v={f.lastName} on={(v) => set('lastName', v)} /></Two>
      <Two><F label="Mobile * (12 digits)" v={f.mobile} kb="number-pad" on={(v) => set('mobile', v.replace(/[^0-9]/g, ''))} /><F label="WhatsApp" v={f.whatsapp} kb="number-pad" on={(v) => set('whatsapp', v.replace(/[^0-9]/g, ''))} /></Two>
      <Two><F label="Passport *" v={f.passport} on={(v) => set('passport', v)} /><F label="Company (optional)" v={f.companyName} on={(v) => set('companyName', v)} /></Two>

      {type === 'HOTEL' ? (
        <>
          <Sec>Hotel</Sec>
          <F label="Hotel Name *" v={f.hotelName} on={(v) => set('hotelName', v)} />
          <Two><F label="Check-in * (YYYY-MM-DD)" v={f.checkInDate} on={(v) => set('checkInDate', v)} /><F label="Check-out *" v={f.checkOutDate} on={(v) => set('checkOutDate', v)} /></Two>
          <Two><F label="Rooms" v={f.rooms} kb="number-pad" on={(v) => set('rooms', v.replace(/[^0-9]/g, ''))} /><F label="Pax" v={f.passengerCount} kb="number-pad" on={(v) => set('passengerCount', v.replace(/[^0-9]/g, ''))} /></Two>
          <Text style={styles.label}>Room Type</Text>
          <View style={styles.chips}>{ROOM_TYPES.map((rt) => <TouchableOpacity key={rt} style={[styles.chip, f.roomType === rt && styles.chipOn]} onPress={() => set('roomType', rt)}><Text style={[styles.chipTxt, f.roomType === rt && { color: '#fff' }]}>{rt}</Text></TouchableOpacity>)}</View>
          <F label="Per-night Price (SAR) *" v={f.perNightPrice} kb="decimal-pad" on={(v) => set('perNightPrice', v.replace(/[^0-9.]/g, ''))} />
        </>
      ) : (
        <>
          <Sec>Transport</Sec>
          <Text style={styles.label}>Vehicle Type *</Text>
          <View style={styles.chips}>{vehicleTypes.map((vt) => <TouchableOpacity key={vt} style={[styles.chip, f.vehicleType === vt && styles.chipOn]} onPress={() => set('vehicleType', vt)}><Text style={[styles.chipTxt, f.vehicleType === vt && { color: '#fff' }]}>{vt}</Text></TouchableOpacity>)}</View>
          <Two><F label="Pickup *" v={f.pickupLocation} on={(v) => set('pickupLocation', v)} /><F label="Drop-off *" v={f.dropoffLocation} on={(v) => set('dropoffLocation', v)} /></Two>
          <Two><F label="Travel Date * (YYYY-MM-DD)" v={f.travelDate} on={(v) => set('travelDate', v)} /><F label="Pax" v={f.passengerCount} kb="number-pad" on={(v) => set('passengerCount', v.replace(/[^0-9]/g, ''))} /></Two>
          <F label="Price (SAR) *" v={f.price} kb="decimal-pad" on={(v) => set('price', v.replace(/[^0-9.]/g, ''))} />
        </>
      )}

      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitTxt}>Create Voucher</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const Sec = ({ children }) => <Text style={styles.sec}>{children}</Text>;
const Two = ({ children }) => <View style={styles.two}>{React.Children.map(children, (c) => <View style={styles.half}>{c}</View>)}</View>;
const F = ({ label, v, on, kb }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} value={v} onChangeText={on} keyboardType={kb || 'default'} placeholderTextColor="#9CA3AF" />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream, padding: 14 },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tog: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  togOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  togTxt: { fontWeight: '700', color: COLORS.text },
  sec: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  two: { flexDirection: 'row', gap: 10 }, half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipTxt: { color: COLORS.text, fontWeight: '600' },
  submit: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
