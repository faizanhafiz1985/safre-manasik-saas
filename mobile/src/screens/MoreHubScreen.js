import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

// Hub for modules that don't warrant a bottom tab. Each row is permission-gated
// and navigates within the "More" stack. New modules get added here per phase.
const ITEMS = [
  { route: 'DirectVouchers', label: 'Direct Vouchers', glyph: '🧾', feature: 'voucher_forms' },
  { route: 'Customers', label: 'Customers', glyph: '👥', feature: 'customers' },
  { route: 'Packages', label: 'Packages', glyph: '🧳', feature: 'packages' },
  { route: 'Hotels', label: 'Hotels', glyph: '🏨', feature: 'hotels' },
  { route: 'Vehicles', label: 'Vehicles', glyph: '🚐', feature: 'transport' },
  { route: 'Routes', label: 'Routes', glyph: '🛣️', feature: 'transport' },
  { route: 'CateringVendors', label: 'Catering Vendors', glyph: '🍽️', feature: 'catering' },
  { route: 'MealPlans', label: 'Meal Plans', glyph: '🥘', feature: 'catering' },
  { route: 'Fleet', label: 'Fleet', glyph: '🚍', feature: 'fleet_trips' },
  { route: 'Users', label: 'Users', glyph: '🧑‍💼', feature: 'users' },
  { route: 'Roles', label: 'Roles & Permissions', glyph: '🔐', feature: 'roles' },
  { route: 'TenantSettings', label: 'Tenant Settings', glyph: '🏢', feature: 'tenant_settings' },
  { route: 'SystemConfig', label: 'System Config', glyph: '⚙️', feature: 'system_config' },
];

export default function MoreHubScreen({ navigation }) {
  const { can } = useAuth();
  const visible = ITEMS.filter((it) => can(it.feature, 'view'));

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 12 }}>
      {visible.map((it) => (
        <TouchableOpacity key={it.route} style={styles.row} onPress={() => navigation.navigate(it.route)}>
          <Text style={styles.glyph}>{it.glyph}</Text>
          <Text style={styles.label}>{it.label}</Text>
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
