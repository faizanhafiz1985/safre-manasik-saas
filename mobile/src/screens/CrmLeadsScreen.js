import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, StyleSheet } from 'react-native';
import api from '../api/client';
import { useList, Loading, Field, ChipPicker, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const SOURCES = ['MANUAL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE', 'EMAIL', 'OTHER'];
const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'CONFIRMED', 'CONVERTED', 'LOST'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const PR_COLOR = { LOW: COLORS.textMuted, MEDIUM: '#4A90D9', HIGH: COLORS.gold, URGENT: COLORS.danger };
const EMPTY = { id: null, fullName: '', phone: '', whatsappNumber: '', email: '', city: '', source: 'MANUAL', status: 'NEW', priority: 'MEDIUM', notes: '' };

export default function CrmLeadsScreen({ navigation }) {
  const { items, loading, refreshing, onRefresh, reload } = useList('/crm/leads', { limit: 100 });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => { navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation]);

  const save = async () => {
    if (!form.fullName.trim()) return Alert.alert('Required', 'Full name is required.');
    const payload = { fullName: form.fullName, phone: form.phone || null, whatsappNumber: form.whatsappNumber || null, email: form.email || null, city: form.city || null, source: form.source, status: form.status, priority: form.priority, notes: form.notes || null };
    setSaving(true);
    try { if (form.id) await api.put(`/crm/leads/${form.id}`, payload); else await api.post('/crm/leads', payload); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save lead.'); }
    finally { setSaving(false); }
  };

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No leads yet.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={() => setForm({ id: item.id, fullName: item.fullName || '', phone: item.phone || '', whatsappNumber: item.whatsappNumber || '', email: item.email || '', city: item.city || '', source: item.source || 'MANUAL', status: item.status || 'NEW', priority: item.priority || 'MEDIUM', notes: item.notes || '' })}>
            <View style={st.row}>
              <Text style={st.name}>{item.fullName}</Text>
              <Text style={[st.badge, { backgroundColor: PR_COLOR[item.priority] || COLORS.textMuted }]}>{item.priority}</Text>
            </View>
            <Text style={st.meta}>{item.status}{item.phone ? ` • ${item.phone}` : ''}{item.city ? ` • ${item.city}` : ''}</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit Lead' : 'Add Lead'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Full Name *" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} />
          <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
          <Field label="WhatsApp" value={form.whatsappNumber} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, whatsappNumber: v })} />
          <Field label="Email" value={form.email} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => setForm({ ...form, email: v })} />
          <Field label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
          <ChipPicker label="Source" value={form.source} options={SOURCES} onChange={(v) => setForm({ ...form, source: v })} />
          <ChipPicker label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm({ ...form, status: v })} />
          <ChipPicker label="Priority" value={form.priority} options={PRIORITIES} onChange={(v) => setForm({ ...form, priority: v })} />
          <Field label="Notes" value={form.notes} multiline style={{ height: 70, textAlignVertical: 'top' }} onChangeText={(v) => setForm({ ...form, notes: v })} />
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
});
