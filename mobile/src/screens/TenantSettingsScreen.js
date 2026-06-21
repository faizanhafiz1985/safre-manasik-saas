import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import api from '../api/client';
import { Field, ChipPicker, SwitchRow, Loading } from '../components/ui';
import { COLORS } from '../theme';

const CURRENCIES = ['SAR', 'USD', 'EUR', 'GBP'];
const LANGS = [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }, { value: 'ur', label: 'اردو' }, { value: 'id', label: 'Indonesia' }];

export default function TenantSettingsScreen() {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/tenant/current').then(({ data }) => setF({
      name: data.name || '', contactEmail: data.contactEmail || '', contactPhone: data.contactPhone || '',
      crNumber: data.crNumber || '', vatNumber: data.vatNumber || '', umrahLicenseNumber: data.umrahLicenseNumber || '',
      address: data.address || '', city: data.city || '', currency: data.currency || 'SAR', language: data.language || 'en',
      timezone: data.timezone || 'Asia/Riyadh', primaryColor: data.primaryColor || '#1B4B35', logoUrl: data.logoUrl || '',
      paypalEnabled: !!data.paypalEnabled, paypalMode: data.paypalMode || 'sandbox', paypalClientId: data.paypalClientId || '', paypalSecret: data.paypalSecret || '',
    })).catch((e) => Alert.alert('Error', e.response?.data?.error || 'Failed to load settings'));
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (f.crNumber && !/^\d{10}$/.test(f.crNumber)) return Alert.alert('Invalid', 'CR Number must be 10 digits.');
    if (f.vatNumber && !/^\d{15}$/.test(f.vatNumber)) return Alert.alert('Invalid', 'VAT Number must be 15 digits.');
    setSaving(true);
    try { await api.put('/tenant/current', f); Alert.alert('Saved', 'Settings updated.'); }
    catch (e) { Alert.alert('Save failed', e.response?.data?.error || 'Could not save.'); }
    finally { setSaving(false); }
  };

  if (!f) return <Loading />;
  return (
    <ScrollView style={st.root} contentContainerStyle={{ padding: 14 }} keyboardShouldPersistTaps="handled">
      <Sec>Organisation</Sec>
      <Field label="Name" value={f.name} onChangeText={(v) => set('name', v)} />
      <Field label="Contact Email" value={f.contactEmail} keyboardType="email-address" autoCapitalize="none" onChangeText={(v) => set('contactEmail', v)} />
      <Field label="Contact Phone" value={f.contactPhone} keyboardType="phone-pad" onChangeText={(v) => set('contactPhone', v)} />
      <Field label="Address" value={f.address} onChangeText={(v) => set('address', v)} />
      <Field label="City" value={f.city} onChangeText={(v) => set('city', v)} />

      <Sec>Saudi Compliance</Sec>
      <Field label="CR Number (10 digits)" value={f.crNumber} keyboardType="number-pad" maxLength={10} onChangeText={(v) => set('crNumber', v.replace(/[^0-9]/g, ''))} />
      <Field label="VAT Number (15 digits)" value={f.vatNumber} keyboardType="number-pad" maxLength={15} onChangeText={(v) => set('vatNumber', v.replace(/[^0-9]/g, ''))} />
      <Field label="Umrah License #" value={f.umrahLicenseNumber} onChangeText={(v) => set('umrahLicenseNumber', v)} />

      <Sec>Localisation & Branding</Sec>
      <ChipPicker label="Currency" value={f.currency} options={CURRENCIES} onChange={(v) => set('currency', v)} />
      <ChipPicker label="Language" value={f.language} options={LANGS} onChange={(v) => set('language', v)} />
      <Field label="Timezone" value={f.timezone} onChangeText={(v) => set('timezone', v)} />
      <Field label="Primary Colour (hex)" value={f.primaryColor} autoCapitalize="none" onChangeText={(v) => set('primaryColor', v)} />
      <Field label="Logo URL" value={f.logoUrl} autoCapitalize="none" onChangeText={(v) => set('logoUrl', v)} hint="Public HTTPS image URL" />

      <Sec>Payment Gateway (PayPal)</Sec>
      <SwitchRow label="PayPal enabled" value={f.paypalEnabled} onValueChange={(v) => set('paypalEnabled', v)} />
      {f.paypalEnabled && <>
        <ChipPicker label="Mode" value={f.paypalMode} options={[{ value: 'sandbox', label: 'Sandbox' }, { value: 'live', label: 'Live' }]} onChange={(v) => set('paypalMode', v)} />
        <Field label="PayPal Client ID" value={f.paypalClientId} autoCapitalize="none" onChangeText={(v) => set('paypalClientId', v)} />
        <Field label="PayPal Secret" value={f.paypalSecret} secureTextEntry onChangeText={(v) => set('paypalSecret', v)} hint="Leave the masked value to keep the existing secret" />
      </>}

      <TouchableOpacity style={[st.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveTxt}>Save Settings</Text>}
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const Sec = ({ children }) => <Text style={st.sec}>{children}</Text>;
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  sec: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  save: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  saveTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
