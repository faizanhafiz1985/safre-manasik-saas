import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Switch, ScrollView,
  ActivityIndicator, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { COLORS } from '../theme';

// ── Data hook: list that refetches on focus, tolerant of array or {data} ──────
export function useList(path, params) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    try { const r = await api.get(path, { params }); setItems(Array.isArray(r.data) ? r.data : (r.data.data || [])); }
    catch { /* leave empty */ } finally { setLoading(false); setRefreshing(false); }
  }, [path, JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { items, loading, refreshing, reload, onRefresh: () => { setRefreshing(true); reload(); } };
}

export const Loading = () => <View style={s.center}><ActivityIndicator color={COLORS.green} /></View>;
export const Empty = ({ text }) => <View style={s.center}><Text style={s.muted}>{text || 'Nothing here yet.'}</Text></View>;

export const Field = ({ label, hint, style, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <TextInput style={[s.input, props.editable === false && s.inputDisabled, style]} placeholderTextColor="#9CA3AF" {...props} />
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
  </View>
);

export const ChipPicker = ({ label, value, options, onChange }) => (
  <View style={{ marginBottom: 12 }}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <View style={s.chips}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lab = typeof o === 'string' ? o : o.label;
        return (
          <TouchableOpacity key={val} style={[s.chip, value === val && s.chipOn]} onPress={() => onChange(val)}>
            <Text style={[s.chipTxt, value === val && { color: '#fff' }]}>{lab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const SwitchRow = ({ label, value, onValueChange }) => (
  <View style={s.switchRow}>
    <Text style={s.label}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: COLORS.greenMid }} />
  </View>
);

// Modal list picker (e.g. choose a vendor). options: [{id, label}]
export const Selector = ({ label, text, placeholder, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TouchableOpacity style={s.selector} onPress={() => setOpen(true)}>
        <Text style={text ? s.selText : s.selPlaceholder}>{text || placeholder || 'Select…'}</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.pickModal}>
          <View style={s.pickHead}><Text style={s.pickTitle}>{label || 'Select'}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}><Text style={s.close}>Close</Text></TouchableOpacity></View>
          <FlatList data={options} keyExtractor={(o) => String(o.id)}
            ListEmptyComponent={<Text style={[s.muted, { padding: 16 }]}>Nothing to choose.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.pickRow} onPress={() => { onSelect(item); setOpen(false); }}>
                <Text style={s.pickName}>{item.label}</Text>
              </TouchableOpacity>
            )} />
        </View>
      </Modal>
    </View>
  );
};

// Bottom-sheet form modal with Cancel / Save.
export const Sheet = ({ visible, title, onClose, onSave, saving, saveLabel = 'Save', children }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.sheetRoot}>
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>{children}</ScrollView>
        <View style={s.actions}>
          <TouchableOpacity onPress={onClose} style={s.cancel} disabled={saving}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={onSave} style={[s.save, saving && { opacity: 0.6 }]} disabled={saving}>
            <Text style={s.saveTxt}>{saving ? '…' : saveLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Header "＋ New" button helper for navigation.setOptions.
export const AddHeaderButton = (onPress) => () => (
  <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 12 }}>
    <Text style={{ color: COLORS.gold, fontWeight: '700', fontSize: 15 }}>＋ New</Text>
  </TouchableOpacity>
);

export const ListCard = ({ onPress, children }) => (
  <TouchableOpacity style={s.card} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>{children}</TouchableOpacity>
);

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#fff' },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#9CA3AF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  chipTxt: { color: COLORS.text, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  selector: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  selText: { color: COLORS.text }, selPlaceholder: { color: '#9CA3AF' },
  pickModal: { flex: 1, backgroundColor: '#fff' },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.greenDark },
  pickTitle: { color: '#fff', fontWeight: '800', fontSize: 16 }, close: { color: COLORS.gold, fontWeight: '700' },
  pickRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border }, pickName: { fontSize: 15, color: COLORS.text },
  sheetRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 26 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark, marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 },
  cancel: { paddingVertical: 12, paddingHorizontal: 18 }, cancelTxt: { color: COLORS.textMuted, fontWeight: '700' },
  save: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 }, saveTxt: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 14, borderRadius: 12 },
});

export const cardStyles = s;
