import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, SwitchRow, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const EMPTY = { id: null, name: '', contactName: '', phone: '', email: '', speciality: '', isActive: true };

export default function CateringVendorsScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/catering/vendors');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can('catering', 'create') || can('catering', 'edit');

  useLayoutEffect(() => { if (can('catering', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation, can]);

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Required', 'Vendor name is required.');
    const payload = { name: form.name, contactName: form.contactName || null, phone: form.phone || null, email: form.email || null, speciality: form.speciality || null, isActive: form.isActive };
    setSaving(true);
    try { if (form.id) await api.put(`/catering/vendors/${form.id}`, payload); else await api.post('/catering/vendors', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save vendor.'); }
    finally { setSaving(false); }
  };
  const del = () => Alert.alert('Delete vendor?', 'This also affects its meal plans.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/catering/vendors/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No vendors yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={canEdit ? () => setForm({ id: item.id, name: item.name || '', contactName: item.contactName || '', phone: item.phone || '', email: item.email || '', speciality: item.speciality || '', isActive: item.isActive !== false }) : null}>
            <Text style={st.name}>{item.name}</Text>
            <Text style={st.meta}>{[item.contactName, item.phone, item.speciality].filter(Boolean).join(' • ') || '—'}</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Vendor' : 'Add Vendor'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Vendor Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="Contact Name" value={form.contactName} onChangeText={(v) => setForm({ ...form, contactName: v })} />
          <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
          <Field label="Email" value={form.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => setForm({ ...form, email: v })} />
          <Field label="Speciality" value={form.speciality} onChangeText={(v) => setForm({ ...form, speciality: v })} />
          <SwitchRow label="Active" value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} />
          {form.id && can('catering', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete vendor</Text></TouchableOpacity>}
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
