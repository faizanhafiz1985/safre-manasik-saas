import React, { useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import api from '../api/client';
import { useList, Loading, Field, ChipPicker, Sheet, AddHeaderButton } from '../components/ui';
import { COLORS } from '../theme';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const ST_COLOR = { PENDING: COLORS.gold, IN_PROGRESS: '#4A90D9', COMPLETED: COLORS.success, OVERDUE: COLORS.danger, CANCELLED: COLORS.textMuted };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No due date');
const EMPTY = { title: '', description: '', dueAt: '', priority: 'MEDIUM' };

export default function CrmTasksScreen({ navigation }) {
  const { items, loading, refreshing, onRefresh, reload } = useList('/crm/tasks', { limit: 100 });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => { navigation.setOptions({ headerRight: AddHeaderButton(() => setForm({ ...EMPTY })) }); }, [navigation]);

  const save = async () => {
    if (!form.title.trim()) return Alert.alert('Required', 'Title is required.');
    setSaving(true);
    try { await api.post('/crm/tasks', { title: form.title, description: form.description || null, dueAt: form.dueAt || null, priority: form.priority }); setForm(null); reload(); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save task.'); }
    finally { setSaving(false); }
  };
  const complete = async (id) => { try { await api.post(`/crm/tasks/${id}/complete`); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not complete.'); } };

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={items} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={st.muted}>No tasks.</Text>} contentContainerStyle={items.length === 0 && st.center}
        renderItem={({ item }) => (
          <View style={st.card}>
            <View style={st.row}>
              <Text style={st.title}>{item.title}</Text>
              <Text style={[st.badge, { backgroundColor: ST_COLOR[item.status] || COLORS.textMuted }]}>{item.status}</Text>
            </View>
            <Text style={st.meta}>Due {fmt(item.dueAt)} • {item.priority}</Text>
            {item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && (
              <TouchableOpacity style={st.done} onPress={() => complete(item.id)}><Text style={st.doneTxt}>✓ Mark complete</Text></TouchableOpacity>
            )}
          </View>
        )} />
      <Sheet visible={!!form} title="New Task" onClose={() => setForm(null)} onSave={save} saving={saving} saveLabel="Create">
        {form && <>
          <Field label="Title *" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
          <Field label="Due Date (YYYY-MM-DD)" value={form.dueAt} onChangeText={(v) => setForm({ ...form, dueAt: v })} />
          <ChipPicker label="Priority" value={form.priority} options={PRIORITIES} onChange={(v) => setForm({ ...form, priority: v })} />
          <Field label="Description" value={form.description} multiline style={{ height: 70, textAlignVertical: 'top' }} onChangeText={(v) => setForm({ ...form, description: v })} />
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted },
  card: { backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 14, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark, flexShrink: 1 },
  badge: { color: '#fff', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', marginLeft: 8 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  done: { marginTop: 10, borderWidth: 1, borderColor: COLORS.green, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  doneTxt: { color: COLORS.green, fontWeight: '700' },
});
