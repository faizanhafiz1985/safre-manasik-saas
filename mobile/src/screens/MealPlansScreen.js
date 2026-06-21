import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, ChipPicker, Selector, SwitchRow, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const MEALS = ['BREAKFAST', 'LUNCH', 'DINNER'];
const EMPTY = { id: null, vendorId: '', vendorName: '', name: '', mealType: 'LUNCH', pricePerPax: '', description: '', isActive: true };

export default function MealPlansScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/catering/meal-plans');
  const { items: vendors } = useList('/catering/vendors');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can('catering', 'create') || can('catering', 'edit');

  useLayoutEffect(() => { if (can('catering', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation, can]);

  const save = async () => {
    if (!form.vendorId) return Alert.alert('Required', 'Select a vendor.');
    if (!form.name.trim()) return Alert.alert('Required', 'Plan name is required.');
    if (form.pricePerPax === '' || !(Number(form.pricePerPax) >= 0)) return Alert.alert('Required', 'Valid price per pax is required.');
    const payload = { vendorId: form.vendorId, name: form.name, mealType: form.mealType, pricePerPax: Number(form.pricePerPax), description: form.description || null, isActive: form.isActive };
    setSaving(true);
    try { if (form.id) await api.put(`/catering/meal-plans/${form.id}`, payload); else await api.post('/catering/meal-plans', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save meal plan.'); }
    finally { setSaving(false); }
  };
  const del = () => Alert.alert('Delete meal plan?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/catering/meal-plans/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No meal plans yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={canEdit ? () => setForm({ id: item.id, vendorId: item.vendorId || item.vendor?.id || '', vendorName: item.vendor?.name || '', name: item.name || '', mealType: item.mealType || 'LUNCH', pricePerPax: item.pricePerPax != null ? String(item.pricePerPax) : '', description: item.description || '', isActive: item.isActive !== false }) : null}>
            <Text style={st.name}>{item.name}</Text>
            <Text style={st.meta}>{item.vendor?.name || ''} • {item.mealType} • SAR {Number(item.pricePerPax || 0).toLocaleString()}/pax</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Meal Plan' : 'Add Meal Plan'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Selector label="Vendor *" text={form.vendorName} placeholder="Select vendor"
            options={vendors.map((v) => ({ id: v.id, label: v.name }))}
            onSelect={(o) => setForm({ ...form, vendorId: o.id, vendorName: o.label })} />
          <Field label="Plan Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <ChipPicker label="Meal Type" value={form.mealType} options={MEALS} onChange={(v) => setForm({ ...form, mealType: v })} />
          <Field label="Price / pax (SAR) *" value={form.pricePerPax} keyboardType="decimal-pad" onChangeText={(v) => setForm({ ...form, pricePerPax: v.replace(/[^0-9.]/g, '') })} />
          <Field label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
          <SwitchRow label="Active" value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} />
          {form.id && can('catering', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete meal plan</Text></TouchableOpacity>}
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted }, name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark }, meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  del: { color: COLORS.danger, fontWeight: '700', textAlign: 'center', paddingVertical: 10, marginTop: 4 },
});
