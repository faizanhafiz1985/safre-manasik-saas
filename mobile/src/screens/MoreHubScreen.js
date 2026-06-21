import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { COLORS } from '../theme';

// Hub for modules that don't warrant a bottom tab. Each row is permission-gated
// and navigates within the "More" stack. `tkey` maps to an i18n string.
const ITEMS = [
  { route: 'DirectVouchers', tkey: 'directVouchers', glyph: '🧾', feature: 'voucher_forms' },
  { route: 'Customers', tkey: 'customers', glyph: '👥', feature: 'customers' },
  { route: 'Packages', tkey: 'packages', glyph: '🧳', feature: 'packages' },
  { route: 'Hotels', tkey: 'hotels', glyph: '🏨', feature: 'hotels' },
  { route: 'Vehicles', tkey: 'vehicles', glyph: '🚐', feature: 'transport' },
  { route: 'Routes', tkey: 'routes', glyph: '🛣️', feature: 'transport' },
  { route: 'CateringVendors', tkey: 'cateringVendors', glyph: '🍽️', feature: 'catering' },
  { route: 'MealPlans', tkey: 'mealPlans', glyph: '🥘', feature: 'catering' },
  { route: 'Fleet', tkey: 'fleet', glyph: '🚍', feature: 'fleet_trips' },
  { route: 'CrmLeads', tkey: 'leads', glyph: '🎯', feature: 'crm_leads' },
  { route: 'CrmPipeline', tkey: 'pipeline', glyph: '📊', feature: 'crm_pipeline' },
  { route: 'CrmTasks', tkey: 'tasks', glyph: '✅', feature: 'crm_tasks' },
  { route: 'CrmInbox', tkey: 'inbox', glyph: '💬', feature: 'crm_inbox' },
  { route: 'DailySchedule', tkey: 'dailySchedule', glyph: '📅', feature: 'daily_schedule' },
  { route: 'TransportReport', tkey: 'transportReport', glyph: '📈', feature: 'transport_report' },
  { route: 'Users', tkey: 'users', glyph: '🧑‍💼', feature: 'users' },
  { route: 'Roles', tkey: 'roles', glyph: '🔐', feature: 'roles' },
  { route: 'TenantSettings', tkey: 'tenantSettings', glyph: '🏢', feature: 'tenant_settings' },
  { route: 'SystemConfig', tkey: 'systemConfig', glyph: '⚙️', feature: 'system_config' },
];

export default function MoreHubScreen({ navigation }) {
  const { can } = useAuth();
  const { t } = useI18n();
  const visible = ITEMS.filter((it) => can(it.feature, 'view'));

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 12 }}>
      {visible.map((it) => (
        <TouchableOpacity key={it.route} style={styles.row} onPress={() => navigation.navigate(it.route)}>
          <Text style={styles.glyph}>{it.glyph}</Text>
          <Text style={styles.label}>{t(it.tkey)}</Text>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
      {visible.length === 0 && <Text style={styles.muted}>No additional modules available for your role.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  glyph: { fontSize: 20, width: 34 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.greenDark },
  chev: { fontSize: 22, color: COLORS.textMuted },
  muted: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
});
