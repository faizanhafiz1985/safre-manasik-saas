import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, REFRESH_KEY } from '../config';

// Tokens live in the OS keychain/keystore (never AsyncStorage).
export const getAccessToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);

export async function saveTokens({ token, refreshToken }) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
}
