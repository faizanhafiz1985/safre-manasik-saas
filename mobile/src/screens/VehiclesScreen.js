import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, SwitchRow, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const EMPTY = { id: null, name: '', plateNumber: '', type: 'BUS', capacity: '20', driverName: '', driverPhone: '', driverIqama: '', isAvailable: true };

export default function VehiclesScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/transport/vehicles');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can('transport', 'create') || can('transport', 'edit');

  useLayoutEffect(() => { if (can('transport', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation, can]);

  const openEdit = (v) => setForm({
    id: v.id, name: v.name || '', plateNumber: v.plateNumber || '', type: v.type || 'BUS',
    capacity: String(v.capacity || 0), driverName: v.driverName || '', driverPhone: v.driverPhone || '',
    driverIqama: v.driverIqama || '', isAvailable: v.isAvailable !== false,
  });

  const save = async () => {
    if (!form.name.trim() || !form.plateNumber.trim()) return Alert.alert('Required', 'Name and plate number are required.');
    if (!/^\d{10}$/.test(form.driverIqama)) return Alert.alert('Invalid', 'Driver Iqama # must be exactly 10 digits.');
    const payload = {
      name: form.name, plateNumber: form.plateNumber, type: form.type, capacity: Number(form.capacity) || 0,
      driverName: form.driverName, driverPhone: form.driverPhone, driverIqama: form.driverIqama, isAvailable: form.isAvailable,
    };
    setSaving(true);
    try { if (form.id) await api.put(`/transport/vehicles/${form.id}`, payload); else await api.post('/transport/vehicles', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save vehicle.'); }
    finally { setSaving(false); }
  };

  const del = () => Alert.alert('Delete vehicle?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/transport/vehicles/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No vehicles yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={canEdit ? () => openEdit(item) : null}>
            <Text style={st.name}>{item.name} <Text style={st.plate}>{item.plateNumber}</Text></Text>
            <Text style={st.meta}>{item.type} • {item.capacity} seats • {item.driverName || 'No driver'}</Text>
            <Text style={st.meta}>{item.isAvailable === false ? '🔴 Unavailable' : '🟢 Available'}</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="Plate Number *" value={form.plateNumber} onChangeText={(v) => setForm({ ...form, plateNumber: v })} />
          <Field label="Type" value={form.type} onChangeText={(v) => setForm({ ...form, type: v })} hint="e.g. BUS, CAR, VIP, SUV, COASTER" />
          <Field label="Capacity (seats)" value={form.capacity} keyboardType="number-pad" onChangeText={(v) => setForm({ ...form, capacity: v.replace(/[^0-9]/g, '') })} />
          <Field label="Driver Name" value={form.driverName} onChangeText={(v) => setForm({ ...form, driverName: v })} />
          <Field label="Driver Phone" value={form.driverPhone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, driverPhone: v })} />
          <Field label="Driver Iqama # * (10 digits)" value={form.driverIqama} keyboardType="number-pad" maxLength={10} onChangeText={(v) => setForm({ ...form, driverIqama: v.replace(/[^0-9]/g, '') })} />
          <SwitchRow label="Available" value={form.isAvailable} onValueChange={(v) => setForm({ ...form, isAvailable: v })} />
          {form.id && can('transport', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete vehicle</Text></TouchableOpacity>}
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark }, plate: { color: COLORS.gold, fontSize: 13 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  del: { color: COLORS.danger, fontWeight: '700', textAlign: 'center', paddingVertical: 10, marginTop: 4 },
});
