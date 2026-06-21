import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { COLORS } from '../theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) { Alert.alert('Missing details', 'Enter your email and password.'); return; }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      Alert.alert('Login failed', e.response?.data?.error || 'Check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.brand}>Safre Manasik</Text>
        <Text style={styles.sub}>Umrah Travel Management</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input} autoCapitalize="none" keyboardType="email-address"
          placeholder="you@agency.com" placeholderTextColor="#9CA3AF"
          value={email} onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input} secureTextEntry placeholder="••••••••" placeholderTextColor="#9CA3AF"
          value={password} onChangeText={setPassword}
        />

        <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.greenDark, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24 },
  brand: { fontSize: 26, fontWeight: '800', color: COLORS.greenDark, textAlign: 'center' },
  sub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  btn: { backgroundColor: COLORS.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
