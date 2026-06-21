import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import api from '../api/client';
import { Field, Loading } from '../components/ui';
import { COLORS } from '../theme';

const FIELDS = [
  { key: 'company_name', label: 'Company Name' },
  { key: 'company_phone', label: 'Phone' },
  { key: 'company_email', label: 'Email' },
  { key: 'company_address', label: 'Address' },
  { key: 'currency', label: 'Currency Code (e.g. SAR)' },
  { key: 'vat_percentage', label: 'VAT Percentage (%)' },
  { key: 'booking_tentative_days', label: 'Tentative Booking Expiry (days)' },
  { key: 'terms_hotel_voucher', label: 'Hotel Voucher — Terms & Conditions', multiline: true },
  { key: 'terms_transport_voucher', label: 'Transport Voucher — Terms & Conditions', multiline: true },
  { key: 'terms_invoice', label: 'Invoice — Terms & Conditions', multiline: true },
  { key: 'vehicle_types', label: 'Vehicle Types (comma-separated)', multiline: true },
];

export default function SystemConfigScreen() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/config').then(({ data }) => {
      const m = { ...data };
      const legacy = (m.voucher_terms || '').trim();
      if (legacy) ['terms_hotel_voucher', 'terms_transport_voucher', 'terms_invoice'].forEach((k) => { if (!m[k]) m[k] = legacy; });
      setCfg(m);
    }).catch((e) => Alert.alert('Error', e.response?.data?.error || 'Failed to load config'));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const configs = {};
      FIELDS.forEach((f) => { configs[f.key] = cfg[f.key] ?? ''; });
      await api.post('/config', { configs });
      Alert.alert('Saved', 'Configuration updated.');
    } catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save.'); }
    finally { setSaving(false); }
  };

  if (!cfg) return <Loading />;
  return (
    <ScrollView style={st.root} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label} value={cfg[f.key] != null ? String(cfg[f.key]) : ''}
          multiline={f.multiline} style={f.multiline ? { height: 80, textAlignVertical: 'top' } : undefined}
          onChangeText={(v) => setCfg((p) => ({ ...p, [f.key]: v }))} />
      ))}
      <TouchableOpacity style={[st.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveTxt}>Save Configuration</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  save: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
