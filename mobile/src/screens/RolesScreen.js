import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useList, Loading, Field, Sheet, AddHeaderButton, ListCard } from '../components/ui';
import { COLORS } from '../theme';

export default function RolesScreen({ navigation }) {
  const { can } = useAuth();
  const { items: roles, loading, refreshing, onRefresh, reload } = useList('/rbac/roles');
  const [catalog, setCatalog] = useState({ features: [], actions: [] });
  const [role, setRole] = useState(null);       // role being edited (matrix)
  const [draft, setDraft] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(null);

  useEffect(() => { api.get('/rbac/catalog').then((r) => setCatalog(r.data)).catch(() => {}); }, []);
  useLayoutEffect(() => { if (can('roles', 'create')) navigation.setOptions({ headerRight: AddHeaderButton(() => setCreateForm({ name: '', description: '' })) }); }, [navigation, can]);

  const openRole = (r) => { setRole(r); setDraft(new Set(r.permissions || [])); };
  const toggle = (key) => setDraft((d) => { const n = new Set(d); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const savePerms = async () => {
    setSaving(true);
    try { await api.put(`/rbac/roles/${role.id}/permissions`, { permissions: [...draft] }); setRole(null); reload(); }
    catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not save permissions.'); }
    finally { setSaving(false); }
  };
  const createRole = async () => {
    if (!createForm.name.trim()) return Alert.alert('Required', 'Role name is required.');
    setSaving(true);
    try { await api.post('/rbac/roles', { name: createForm.name, description: createForm.description }); setCreateForm(null); reload(); }
    catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not create role.'); }
    finally { setSaving(false); }
  };
  const delRole = (r) => Alert.alert('Delete role?', `Users with "${r.name}" revert to their built-in role.`, [{ text: 'No' }, { text: 'Yes', style: 'destructive', onPress: async () => { try { await api.delete(`/rbac/roles/${r.id}`); reload(); } catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not delete.'); } } }]);

  if (loading) return <Loading />;
  return (
    <View style={st.root}>
      <FlatList data={roles} keyExtractor={(it) => it.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <ListCard onPress={() => openRole(item)}>
            <View style={st.row}>
              <Text style={st.name}>{item.name} {item.isSystem ? <Text style={st.sys}>built-in</Text> : null}</Text>
              {!item.isSystem && can('roles', 'delete') ? <TouchableOpacity onPress={() => delRole(item)}><Text style={st.delSmall}>Delete</Text></TouchableOpacity> : null}
            </View>
            <Text style={st.meta}>{item.userCount ?? 0} user(s) • {(item.permissions || []).length} permissions</Text>
          </ListCard>
        )} />

      {/* Permission matrix */}
      <Modal visible={!!role} animationType="slide" onRequestClose={() => setRole(null)}>
        <View style={st.matrixRoot}>
          <View style={st.matrixHead}>
            <Text style={st.matrixTitle}>{role?.name}</Text>
            <TouchableOpacity onPress={() => setRole(null)}><Text style={st.close}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <Text style={st.hint}>“view” controls whether the module is visible. Greyed rows are plan-locked or reserved for the built-in Admin.</Text>
            {catalog.features.map((f) => {
              const locked = f.planLocked || (f.adminOnly && !role?.isSystem);
              return (
                <View key={f.key} style={[st.feat, locked && { opacity: 0.45 }]}>
                  <Text style={st.featLabel}>{f.label}{f.adminOnly ? ' 🔒' : ''}{f.planLocked ? ' (plan)' : ''}</Text>
                  <View style={st.acts}>
                    {catalog.actions.map((a) => {
                      const key = `${f.key}:${a}`; const on = draft.has(key);
                      return (
                        <TouchableOpacity key={a} disabled={locked} style={[st.act, on && st.actOn]} onPress={() => toggle(key)}>
                          <Text style={[st.actTxt, on && { color: '#fff' }]}>{a}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={st.saveBar}>
            <TouchableOpacity style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={savePerms} disabled={saving}>
              <Text style={st.saveTxt}>{saving ? 'Saving…' : 'Save Permissions'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Sheet visible={!!createForm} title="New Custom Role" onClose={() => setCreateForm(null)} onSave={createRole} saving={saving} saveLabel="Create">
        {createForm && <>
          <Field label="Role Name *" value={createForm.name} onChangeText={(v) => setCreateForm({ ...createForm, name: v })} />
          <Field label="Description" value={createForm.description} onChangeText={(v) => setCreateForm({ ...createForm, description: v })} />
          <Text style={st.hint}>After creating, tap the role to set its permissions.</Text>
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark }, sys: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  delSmall: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  matrixRoot: { flex: 1, backgroundColor: COLORS.cream },
  matrixHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.greenDark },
  matrixTitle: { color: '#fff', fontWeight: '800', fontSize: 16 }, close: { color: COLORS.gold, fontWeight: '700' },
  feat: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  featLabel: { fontWeight: '700', color: COLORS.greenDark, marginBottom: 8 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  act: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  actOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  actTxt: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  saveBar: { padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
