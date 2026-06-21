import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { COLORS } from '../theme';

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function CrmConversationScreen({ route, navigation }) {
  const { id, name } = route.params;
  const [convo, setConvo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { navigation.setOptions({ title: name || 'Conversation' }); }, [navigation, name]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/crm/conversations/${id}`);
      setConvo(r.data);
      api.post(`/crm/conversations/${id}/mark-read`).catch(() => {});
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await api.post(`/crm/conversations/${id}/messages`, { body: text.trim() }); setText(''); load(); }
    catch { /* ignore */ } finally { setSending(false); }
  };

  if (loading) return <View style={st.center}><ActivityIndicator color={COLORS.green} /></View>;
  const messages = (convo?.messages || []);

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        data={messages} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={st.muted}>No messages yet.</Text>}
        renderItem={({ item }) => {
          const out = item.direction === 'OUTBOUND' || item.direction === 'OUT';
          return (
            <View style={[st.bubble, out ? st.out : st.in]}>
              <Text style={[st.body, out && { color: '#fff' }]}>{item.body}</Text>
              <Text style={[st.time, out && { color: 'rgba(255,255,255,0.7)' }]}>{fmt(item.sentAt)}</Text>
            </View>
          );
        }}
      />
      <View style={st.inputBar}>
        <TextInput style={st.input} value={text} onChangeText={setText} placeholder="Type a reply…" placeholderTextColor="#9CA3AF" multiline />
        <TouchableOpacity style={[st.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]} onPress={send} disabled={sending || !text.trim()}>
          <Text style={st.sendTxt}>{sending ? '…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted, textAlign: 'center', marginTop: 30 },
  bubble: { maxWidth: '82%', borderRadius: 12, padding: 10, marginBottom: 8 },
  in: { backgroundColor: '#fff', alignSelf: 'flex-start', borderTopLeftRadius: 2 },
  out: { backgroundColor: COLORS.green, alignSelf: 'flex-end', borderTopRightRadius: 2 },
  body: { color: COLORS.text, fontSize: 14 }, time: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', padding: 8, gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxHeight: 100, color: COLORS.text },
  sendBtn: { backgroundColor: COLORS.green, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 }, sendTxt: { color: '#fff', fontWeight: '700' },
});
