import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

const STATUS_COLOR = { CONFIRMED: COLORS.success, TENTATIVE: COLORS.gold, CANCELLED: COLORS.danger };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function BookingDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const { isStaff } = useAuth();
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get(`/bookings/${id}`);
      setB(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load booking');
    } finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  // Refresh on focus so edits / recorded payments show immediately on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={COLORS.green} /></View>;
  if (!b) return <View style={styles.center}><Text style={styles.muted}>{error || 'Not found'}</Text></View>;

  const hotelTrips = Array.isArray(b.hotelTrips) ? b.hotelTrips : [];
  const transportTrips = Array.isArray(b.transportTrips) ? b.transportTrips : [];

  return (
    <ScrollView style={styles.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.headerRow}>
        <Text style={styles.ref}>{b.bookingRef}</Text>
        <Text style={[styles.badge, { backgroundColor: STATUS_COLOR[b.status] || COLORS.textMuted }]}>{b.status}</Text>
      </View>

      <Section title="Customer">
        <Row label="Name" value={b.customer?.name} />
        <Row label="Email" value={b.customer?.email} />
        <Row label="Phone" value={b.customer?.phone || '—'} />
      </Section>

      <Section title="Trip">
        <Row label="Package" value={b.package?.name || 'Ad-hoc'} />
        <Row label="Departure" value={fmtDate(b.travelDateFrom)} />
        <Row label="Return" value={fmtDate(b.travelDateTo)} />
        <Row label="Pax" value={String(b.totalPax)} />
        <Row label="Total" value={`${b.currency || 'SAR'} ${Number(b.totalAmount || 0).toLocaleString()}`} />
      </Section>

      {hotelTrips.length > 0 && (
        <Section title={`Hotels (${hotelTrips.length})`}>
          {hotelTrips.map((t, i) => (
            <View key={i} style={styles.lineItem}>
              <Text style={styles.lineTitle}>{t.hotelName || 'Hotel'}</Text>
              <Text style={styles.lineMeta}>{fmtDate(t.checkInDate)} → {fmtDate(t.checkOutDate)} • {t.rooms || 1} rm{t.roomType ? ` • ${t.roomType}` : ''}</Text>
            </View>
          ))}
        </Section>
      )}

      {transportTrips.length > 0 && (
        <Section title={`Transport (${transportTrips.length})`}>
          {transportTrips.map((t, i) => (
            <View key={i} style={styles.lineItem}>
              <Text style={styles.lineTitle}>{t.vehicleType || 'Vehicle'}</Text>
              <Text style={styles.lineMeta}>{t.pickupLocation} → {t.dropoffLocation} • {fmtDate(t.travelDate)}</Text>
            </View>
          ))}
        </Section>
      )}

      {Array.isArray(b.passengers) && b.passengers.length > 0 && (
        <Section title={`Passengers (${b.passengers.length})`}>
          {b.passengers.map((p) => (
            <View key={p.id} style={styles.lineItem}>
              <Text style={styles.lineTitle}>{p.fullName}</Text>
              <Text style={styles.lineMeta}>{p.passportNo} • {p.nationality}</Text>
            </View>
          ))}
        </Section>
      )}

      <View style={{ padding: 12 }}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Payments', { id })}>
          <Text style={styles.btnOutlineText}>Payments & Invoice</Text>
        </TouchableOpacity>
        {isStaff && b.status !== 'CANCELLED' && (
          <TouchableOpacity style={[styles.btnOutline, { marginTop: 10 }]} onPress={() => navigation.navigate('BookingForm', { booking: b })}>
            <Text style={styles.btnOutlineText}>Edit Booking</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Voucher</Text>
        <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('Voucher', { id, type: 'TENTATIVE', ref: b.bookingRef })}>
          <Text style={styles.btnOutlineText}>View Tentative Voucher</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { marginTop: 10 }]} onPress={() => navigation.navigate('Voucher', { id, type: 'CONFIRMED', ref: b.bookingRef })}>
          <Text style={styles.btnText}>View Confirmed Voucher</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);
const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  ref: { fontSize: 18, fontWeight: '800', color: COLORS.greenDark },
  badge: { color: '#fff', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  section: { paddingHorizontal: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.textMuted, fontWeight: '600' },
  rowValue: { color: COLORS.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  lineItem: { paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  lineTitle: { fontWeight: '600', color: COLORS.text },
  lineMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  btn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: COLORS.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnOutlineText: { color: COLORS.green, fontWeight: '700' },
});
