import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, ChipPicker, Selector, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const ROLES = ['ADMIN', 'AGENT', 'CUSTOMER'];
const ROLE_COLOR = { ADMIN: COLORS.gold, AGENT: '#4A90D9', CUSTOMER: COLORS.success, SUPER_ADMIN: '#9B59B6' };
const EMPTY = { id: null, name: '', email: '', role: 'CUSTOMER', phone: '', password: '', companyName: '', customRoleId: '', customRoleName: '' };

export default function UsersScreen({ navigation }) {
  const { can } = useAuth();
  const { items, loading, refreshing, onRefresh, reload } = useList('/users', { limit: 100 });
  const { items: roles } = useList('/rbac/roles');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => { navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation]);

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Required', 'Name is required.');
    if (!form.id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return Alert.alert('Required', 'A valid email is required.');
    setSaving(true);
    try {
      let userId = form.id;
      if (form.id) {
        await api.put(`/users/${form.id}`, { name: form.name, phone: form.phone, companyName: form.companyName, role: form.role });
      } else {
        const r = await api.post('/users', { name: form.name, email: form.email, role: form.role, phone: form.phone, companyName: form.companyName, password: form.password || undefined });
        userId = r.data.id;
      }
      // Assign / change the custom (RBAC) role if it differs.
      const orig = form.id ? (items.find((u) => u.id === form.id)?.customRoleId || '') : '';
      if (userId && (form.customRoleId || '') !== orig) {
        await api.put(`/rbac/users/${userId}/role`, { customRoleId: form.customRoleId || null });
      }
      setForm(null); reload();
    } catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save user.'); }
    finally { setSaving(false); }
  };
  const del = () => Alert.alert('Delete user?', 'This cannot be undone.', [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/users/${form.id}`); setForm(null); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Delete failed (user may have bookings — disable instead).'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No users.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <ListCard onPress={item.role !== 'SUPER_ADMIN' ? () => setForm({ id: item.id, name: item.name || '', email: item.email || '', role: item.role, phone: item.phone || '', password: '', companyName: item.companyName || '', customRoleId: item.customRoleId || '', customRoleName: item.customRole?.name || '' }) : null}>
            <View style={st.row}>
              <Text style={st.name}>{item.name}</Text>
              <Text style={[st.badge, { backgroundColor: ROLE_COLOR[item.role] || COLORS.textMuted }]}>{item.role}</Text>
            </View>
            <Text style={st.meta}>{item.email}{item.customRole?.name ? ` • ${item.customRole.name}` : ''}{item.isActive === false ? ' • Disabled' : ''}</Text>
          </ListCard>
        )} />
      <Sheet visible={!!form} title={form?.id ? 'Edit User' : 'Add User'} onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel={form?.id ? 'Update' : 'Create'}>
        {form && <>
          <Field label="Full Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Field label="Email *" value={form.email} editable={!form.id} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => setForm({ ...form, email: v })} hint={form.id ? 'Email is the login ID and cannot be changed' : ''} />
          {!form.id && <Field label="Password" value={form.password} secureTextEntry onChangeText={(v) => setForm({ ...form, password: v })} hint="Leave blank for default Temp@1234" />}
          <ChipPicker label="Role" value={form.role} options={ROLES} onChange={(v) => setForm({ ...form, role: v })} />
          <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
          <Field label="Company (optional)" value={form.companyName} onChangeText={(v) => setForm({ ...form, companyName: v })} />
          <Selector label="Assigned Role (RBAC, optional)" text={form.customRoleName} placeholder="Default (built-in)"
            options={[{ id: '', label: 'Default (built-in)' }, ...roles.map((r) => ({ id: r.id, label: r.name }))]}
            onSelect={(o) => setForm({ ...form, customRoleId: o.id, customRoleName: o.id ? o.label : '' })} />
          {form.id && can('users', 'delete') && <TouchableOpacity onPress={del}><Text style={st.del}>Delete user</Text></TouchableOpacity>}
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
  del: { color: COLORS.danger, fontWeight: '700', textAlign: 'center', paddingVertical: 10, marginTop: 4 },
});
