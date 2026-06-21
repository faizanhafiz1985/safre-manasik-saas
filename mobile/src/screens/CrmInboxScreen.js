import React from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useList, Loading, ListCard } from '../components/ui';
import { COLORS } from '../theme';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '');

export default function CrmInboxScreen({ navigation }) {
  const { items, loading, refreshing, onRefresh } = useList('/crm/conversations');
  if (loading) return <Loading />;
  return (
    <FlatList style={st.root} data={items} keyExtractor={(it) => it.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={items.length === 0 && st.center}
      ListEmptyComponent={<Text style={st.muted}>No conversations.</Text>}
      renderItem={({ item }) => (
        <ListCard onPress={() => navigation.navigate('CrmConversation', { id: item.id, name: item.participantName || item.participantPhone || 'Conversation' })}>
          <View style={st.row}>
            <Text style={st.name}>{item.participantName || item.participantPhone || 'Unknown'}</Text>
            <Text style={st.date}>{fmt(item.lastMessageAt)}</Text>
          </View>
          <Text style={st.meta}>{item.channel}{item.isResolved ? ' • Resolved' : ''}</Text>
        </ListCard>
      )} />
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: COLORS.textMuted }, row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.greenDark }, date: { fontSize: 12, color: COLORS.textMuted },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
});
