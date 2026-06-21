import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../api/client';
import { COLORS } from '../theme';

const EMPTY = { id: null, name: '', email: '', phone: '', companyName: '' };

export default function CustomersScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/customers', { params: { includeInactive: 1, ...(search && { search }) } });
      setItems(data.data || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load customers');
    } finally { setLoading(false); setRefreshing(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Required', 'Name is required.');
    if (!form.id && !form.email.trim()) return Alert.alert('Required', 'Email is required for a new customer.');
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/users/${form.id}`, { name: form.name, phone: form.phone, companyName: form.companyName });
      } else {
        await api.post('/users', { name: form.name, email: form.email, phone: form.phone, companyName: form.companyName, role: 'CUSTOMER' });
      }
      setOpen(false); setForm(EMPTY); load();
    } catch (e) {
      Alert.alert('Save failed', e.response?.data?.error || 'Could not save customer.');
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <TextInput style={styles.search} placeholder="Search customers…" placeholderTextColor="#9CA3AF"
          value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
        <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setOpen(true); }}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={styles.muted}>No customers found.</Text>}
        contentContainerStyle={items.length === 0 && styles.center}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => { setForm({ id: item.id, name: item.name || '', email: item.email || '', phone: item.phone || '', companyName: item.companyName || '' }); setOpen(true); }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.email}{item.phone ? ` • ${item.phone}` : ''}</Text>
            {item.companyName ? <Text style={styles.meta}>{item.companyName}</Text> : null}
            {item.isActive === false ? <Text style={styles.disabled}>Disabled</Text> : null}
          </TouchableOpacity>
        )}
      />

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{form.id ? 'Edit Customer' : 'Add Customer'}</Text>
            <Field label="Full Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Field label="Email *" value={form.email} editable={!form.id} keyboardType="email-address" autoCapitalize="none"
              onChangeText={(v) => setForm({ ...form, email: v })} hint={form.id ? 'Email is the login ID and cannot be changed' : ''} />
            <Field label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(v) => setForm({ ...form, phone: v })} />
            <Field label="Company (optional)" value={form.companyName} onChangeText={(v) => setForm({ ...form, companyName: v })} />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving}>
                <Text style={styles.saveText}>{saving ? '…' : (form.id ? 'Update' : 'Create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const Field = ({ label, hint, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={[styles.input, props.editable === false && { backgroundColor: '#F1F5F9', color: '#9CA3AF' }]} placeholderTextColor="#9CA3AF" {...props} />
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: COLORS.textMuted },
  searchRow: { flexDirection: 'row', padding: 10, gap: 8 },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  addBtn: { backgroundColor: COLORS.green, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 14, borderRadius: 12 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  disabled: { fontSize: 11, color: COLORS.danger, marginTop: 4, fontWeight: '700' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 28 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  cancel: { paddingVertical: 12, paddingHorizontal: 18 },
  cancelText: { color: COLORS.textMuted, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  saveText: { color: '#fff', fontWeight: '700' },
});
