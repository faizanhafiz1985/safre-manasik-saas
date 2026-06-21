import Constants from 'expo-constants';

// API base URL — overridable per build via app.json → expo.extra.apiBaseUrl.
export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'https://api.safremanasik.com/api';

// SecureStore keys
export const TOKEN_KEY = 'sm_access_token';
export const REFRESH_KEY = 'sm_refresh_token';
