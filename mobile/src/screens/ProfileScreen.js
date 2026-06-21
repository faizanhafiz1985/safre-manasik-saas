import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { COLORS } from '../theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  return (
    <View style={styles.root}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.charAt(0) || '?'}</Text></View>
      <Text style={styles.name}>{user?.name}</Text>
      <Text style={styles.muted}>{user?.email}</Text>
      <View style={styles.chip}><Text style={styles.chipText}>{user?.role}</Text></View>

      <View style={styles.info}>
        <Row label={t('tenant')} value={user?.tenant?.name} />
        <Row label={t('phone')} value={user?.phone || '—'} />
        <Row label={t('plan')} value={user?.tenant?.plan || '—'} />
      </View>

      <View style={styles.langWrap}>
        <Text style={styles.langTitle}>{t('language')}</Text>
        <View style={styles.langRow}>
          <TouchableOpacity style={[styles.langBtn, lang === 'en' && styles.langActive]} onPress={() => setLang('en')}>
            <Text style={[styles.langText, lang === 'en' && { color: '#fff' }]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.langBtn, lang === 'ar' && styles.langActive]} onPress={() => setLang('ar')}>
            <Text style={[styles.langText, lang === 'ar' && { color: '#fff' }]}>العربية</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>{t('signOut')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', paddingTop: 32 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.greenDark, marginTop: 12 },
  muted: { color: COLORS.textMuted, marginTop: 2 },
  chip: { backgroundColor: COLORS.goldLight, borderColor: COLORS.gold, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3, marginTop: 8 },
  chipText: { color: COLORS.goldDark || '#9B7A1A', fontWeight: '700', fontSize: 12 },
  info: { backgroundColor: '#fff', borderRadius: 12, padding: 8, marginTop: 24, width: '90%' },
  langWrap: { width: '90%', marginTop: 18 },
  langTitle: { color: COLORS.textMuted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#fff' },
  langActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  langText: { fontWeight: '700', color: COLORS.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.textMuted, fontWeight: '600' },
  rowValue: { color: COLORS.text },
  logout: { marginTop: 28, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  logoutText: { color: COLORS.danger, fontWeight: '700' },
});
