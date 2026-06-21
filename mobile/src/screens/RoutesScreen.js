import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const EMPTY = { id: null, name: '', fromLocation: '', toLocation: '', description: '' };

export default function RoutesScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/transport/routes');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const canEdit = can('transport', 'create') || can('transport', 'edit');

  useLayoutEffect(() => { if (can('transport', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation, can]);

  const save = async () => {
    if (!form.name.trim() || !form.fromLocation.trim() || !form.toLocation.trim()) return Alert.alert('Required', 'Name, from and to are required.');
    const payload = { name: form.name, fromLocation: form.fromLocation, toLocation: form.toLocation, description: form.description || null };
    setSaving(true);
    try { if (form.id) await api.put(`/transport/routes/${form.id}`, payload); else await api.post('/transport/routes', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save route.'); }
    finally { setSaving(false); }
  };
  const del = () => Alert.alert('Delete route?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/transport/routes/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No routes yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={canEdit ? () => setForm({ id: item.id, name: item.name || '', fromLocation: item.fromLocation || '', toLocation: item.toLocation || '', description: item.description || '' }) : null}>
            <Text style={st.name}>{item.name}</Text>
            <Text style={st.meta}>{item.fromLocation} → {item.toLocation}</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Route' : 'Add Route'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Route Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="From *" value={form.fromLocation} onChangeText={(v) => setForm({ ...form, fromLocation: v })} />
          <Field label="To *" value={form.toLocation} onChangeText={(v) => setForm({ ...form, toLocation: v })} />
          <Field label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
          {form.id && can('transport', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete route</Text></TouchableOpacity>}
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
