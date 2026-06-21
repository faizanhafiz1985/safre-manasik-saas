# Safre Manasik — Mobile App (Expo / React Native)

Phase‑3 scaffold for the Android + iOS app, wired to the live API
(`https://api.safremanasik.com/api`). See [`../MOBILE_APP_SPEC.md`](../MOBILE_APP_SPEC.md) for the full spec.

## What's implemented
- **Auth** — mobile login (`client:"mobile"` → 1h access + 30‑day refresh token), tokens in the OS keychain (`expo-secure-store`).
- **Auto‑refresh** — axios interceptor refreshes on `401` (rotating) and retries; hard failure → back to Login.
- **Role/permission‑aware navigation** — tabs show based on the user's `permissions[]` from `/auth/me`.
- **Push registration** — registers the device's FCM/APNs token via `POST /devices` after login.
- **Live screens** — Login, Bookings (`GET /bookings`), Packages (`GET /packages`), Profile (+ logout).

## Run it
```bash
cd mobile
npm install
# align native module versions to the Expo SDK (recommended):
npx expo install expo-secure-store expo-notifications expo-device expo-status-bar \
  react-native-screens react-native-safe-area-context
npx expo start
```
Then press **a** (Android emulator) / **i** (iOS simulator), or scan the QR code.

Sign in with any tenant user (ADMIN/AGENT/CUSTOMER). The tabs and data adapt to the role.

## Push notifications — important
- Push needs a **Dev Build or production build**, *not* Expo Go. Create one with:
  ```bash
  npm install -g eas-cli && eas build --profile development --platform android
  ```
- Backend FCM is already active (`GET /api/devices/push-status` → `authOk:true`).
- **iOS** also needs the APNs key uploaded to Firebase (Apple Developer account required).
- Add `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) from your Firebase project for native FCM in a build.

## Configuration
- API base URL: `app.json → expo.extra.apiBaseUrl` (defaults to production).
- App identifiers: `com.safremanasik.app` (change in `app.json` before store builds).

## Next (not yet built)
- Booking detail + create/edit, voucher/invoice WebView, online payments (PayPal/Moyasar/Apple Pay),
  Customers (staff), Fleet (driver), Arabic RTL/i18n, app icon & splash art.
