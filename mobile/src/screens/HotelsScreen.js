import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, ChipPicker, SwitchRow, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const CITIES = ['MAKKAH', 'MADINAH', 'JEDDAH', 'TAIF'];
const STARS = ['1', '2', '3', '4', '5'];
const EMPTY = { id: null, name: '', city: 'MAKKAH', stars: '3', pricePerNight: '', distanceToHaramMeters: '', address: '', amenities: '', isActive: true };

export default function HotelsScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/hotels');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can('hotels', 'create') || can('hotels', 'edit');

  useLayoutEffect(() => { if (can('hotels', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation, can]);

  const openEdit = (h) => setForm({
    id: h.id, name: h.name || '', city: h.city || 'MAKKAH', stars: String(h.stars || 3),
    pricePerNight: h.pricePerNight != null ? String(h.pricePerNight) : '',
    distanceToHaramMeters: h.distanceToHaramMeters != null ? String(h.distanceToHaramMeters) : '',
    address: h.address || '', amenities: (h.amenities || []).join(', '), isActive: h.isActive !== false,
  });

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Required', 'Hotel name is required.');
    const payload = {
      name: form.name, city: form.city, stars: Number(form.stars) || 3,
      pricePerNight: form.pricePerNight !== '' ? Number(form.pricePerNight) : null,
      distanceToHaramMeters: form.distanceToHaramMeters !== '' ? Number(form.distanceToHaramMeters) : null,
      address: form.address || null,
      amenities: form.amenities ? form.amenities.split(',').map((x) => x.trim()).filter(Boolean) : [],
      isActive: form.isActive,
    };
    setSaving(true);
    try { if (form.id) await api.put(`/hotels/${form.id}`, payload); else await api.post('/hotels', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save hotel.'); }
    finally { setSaving(false); }
  };

  const del = () => Alert.alert('Delete hotel?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/hotels/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No hotels yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={canEdit ? () => openEdit(item) : null}>
            <Text style={st.name}>{item.name} <Text style={st.stars}>{'★'.repeat(item.stars || 0)}</Text></Text>
            <Text style={st.meta}>{item.city}{item.pricePerNight != null ? ` • SAR ${Number(item.pricePerNight).toLocaleString()}/night` : ''}{item.distanceToHaramMeters ? ` • ${item.distanceToHaramMeters}m to Haram` : ''}</Text>
            {item.isActive === false ? <Text style={st.off}>Inactive</Text> : null}
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Hotel' : 'Add Hotel'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Hotel Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <ChipPicker label="City" value={form.city} options={CITIES} onChange={(v) => setForm({ ...form, city: v })} />
          <ChipPicker label="Stars" value={form.stars} options={STARS} onChange={(v) => setForm({ ...form, stars: v })} />
          <Field label="Price / night (SAR)" value={form.pricePerNight} keyboardType="decimal-pad" onChangeText={(v) => setForm({ ...form, pricePerNight: v.replace(/[^0-9.]/g, '') })} />
          <Field label="Distance to Haram (m)" value={form.distanceToHaramMeters} keyboardType="number-pad" onChangeText={(v) => setForm({ ...form, distanceToHaramMeters: v.replace(/[^0-9]/g, '') })} />
          <Field label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
          <Field label="Amenities (comma-separated)" value={form.amenities} onChangeText={(v) => setForm({ ...form, amenities: v })} />
          <SwitchRow label="Active" value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} />
          {form.id && can('hotels', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete hotel</Text></TouchableOpacity>}
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark },
  stars: { color: COLORS.gold, fontSize: 13 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  off: { fontSize: 11, color: COLORS.danger, marginTop: 4, fontWeight: '700' },
  del: { color: COLORS.danger, fontWeight: '700', textAlign: 'center', paddingVertical: 10, marginTop: 4 },
});
