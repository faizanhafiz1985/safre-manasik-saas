import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { Loading } from '../components/ui';
import { COLORS } from '../theme';

export default function CrmPipelineScreen() {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(null); // opportunity being moved

  const load = useCallback(async () => {
    try {
      const list = await api.get('/crm/pipelines').then((r) => (Array.isArray(r.data) ? r.data : (r.data.data || [])));
      const def = list.find((p) => p.isDefault) || list[0];
      if (!def) { setPipeline(null); return; }
      const kanban = await api.get(`/crm/pipelines/${def.id}/kanban`).then((r) => r.data);
      setPipeline(kanban);
    } catch { setPipeline(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const move = async (stageId) => {
    try { await api.put(`/crm/opportunities/${moving.id}/move`, { stageId }); setMoving(null); load(); }
    catch (e) { Alert.alert('Failed', e.response?.data?.error || 'Could not move.'); }
  };

  if (loading) return <Loading />;
  if (!pipeline) return <View style={st.center}><Text style={st.muted}>No pipeline configured.</Text></View>;
  const stages = pipeline.stages || [];

  return (
    <ScrollView style={st.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={st.pname}>{pipeline.name}</Text>
      {stages.map((s) => (
        <View key={s.id} style={st.stage}>
          <View style={[st.stageHead, { borderLeftColor: s.color || COLORS.green }]}>
            <Text style={st.stageName}>{s.name}</Text>
            <Text style={st.count}>{(s.opportunities || []).length}</Text>
          </View>
          {(s.opportunities || []).length === 0 && <Text style={st.empty}>—</Text>}
          {(s.opportunities || []).map((o) => (
            <View key={o.id} style={st.opp}>
              <Text style={st.oppTitle}>{o.title}</Text>
              <Text style={st.oppMeta}>{o.lead?.fullName || ''}{o.value ? ` • ${o.currency || 'SAR'} ${Number(o.value).toLocaleString()}` : ''}</Text>
              <TouchableOpacity onPress={() => setMoving({ ...o, _stages: stages })}><Text style={st.moveTxt}>Move →</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
      <View style={{ height: 24 }} />

      <Modal visible={!!moving} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
        <View style={st.modalRoot}><View style={st.sheet}>
          <Text style={st.sheetTitle}>Move to stage</Text>
          {(moving?._stages || []).map((s) => (
            <TouchableOpacity key={s.id} style={st.stageOpt} onPress={() => move(s.id)}><Text style={st.stageOptTxt}>{s.name}</Text></TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setMoving(null)} style={st.cancel}><Text style={st.cancelTxt}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cream },
  muted: { color: COLORS.textMuted },
  pname: { fontSize: 16, fontWeight: '800', color: COLORS.greenDark, margin: 14, marginBottom: 6 },
  stage: { marginBottom: 12 },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 10, padding: 10, borderRadius: 8, borderLeftWidth: 4 },
  stageName: { fontWeight: '700', color: COLORS.greenDark }, count: { color: COLORS.textMuted, fontWeight: '700' },
  empty: { color: COLORS.textMuted, marginLeft: 18, marginTop: 4 },
  opp: { backgroundColor: '#fff', marginHorizontal: 10, marginTop: 6, padding: 12, borderRadius: 8 },
  oppTitle: { fontWeight: '600', color: COLORS.text }, oppMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  moveTxt: { color: COLORS.green, fontWeight: '700', marginTop: 8 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 30 },
  sheet: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: COLORS.greenDark, marginBottom: 10 },
  stageOpt: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }, stageOptTxt: { fontSize: 15, color: COLORS.text },
  cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 }, cancelTxt: { color: COLORS.textMuted, fontWeight: '700' },
});
