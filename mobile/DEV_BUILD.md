# Dev Build — run the app with push notifications

Expo Go can't receive FCM push, so to test push you need a **development build** (a
real installable app that includes the native FCM client). The build runs on Expo's
cloud (EAS) and is tied to **your** Expo account — so the login + build trigger are
steps **you** perform. Everything else (config, deps) is already done.

## Prerequisites you provide
- A free **Expo account** (https://expo.dev/signup).
- The **Android FCM config file** from Firebase (see Step 2).

## Steps

### 1. Log in to EAS  🔑 (your account)
```
cd "D:\ClaudeProjects\Safre Manasik Application\mobile"
npx eas-cli login        # enter your Expo email + password
npx eas-cli build:configure   # links the project (creates an EAS project id)
```

### 2. Add the Android app in Firebase + download its config  (your Firebase)
1. https://console.firebase.google.com → project **Safre Manasik** → ⚙️ → **Project settings → General**.
2. Under "Your apps" → **Add app → Android**.
3. **Android package name:** `com.safremanasik.app` (must match `app.json`).
4. Register → **Download `google-services.json`**.
5. Put that file in the `mobile/` folder (next to `app.json`).
6. Add this line under `"android"` in `app.json`:
   ```json
   "googleServicesFile": "./google-services.json",
   ```

### 3. Build the Android dev build  ☁️ (your EAS account)
```
npx eas-cli build --profile development --platform android
```
- Takes ~10–20 min on Expo's servers. When done, EAS gives a QR/URL to install the **APK** on your phone.

### 4. Run it against your dev build
```
npx expo start --dev-client
```
Open the installed dev‑build app (not Expo Go) and connect. Log in → the app calls
`POST /devices` and registers your phone's FCM token.

### 5. Test a real push (end‑to‑end)
- Change a booking's status or record a payment in the web app (or via API) for a
  booking owned by the logged‑in customer → the phone should receive a notification.
- Backend FCM is already verified: `GET /api/devices/push-status` → `{ authOk: true }`.

## iOS later
iOS push additionally needs an **Apple Developer account** + an **APNs key** uploaded
to Firebase (Project settings → Cloud Messaging → Apple app configuration), plus an
iOS dev build (`--platform ios`). See `../MOBILE_APP_SPEC.md` §13a.

## Notes
- `eas.json` already defines the `development`, `preview`, and `production` profiles.
- `expo-dev-client` is installed, so `expo start --dev-client` works.
- No code change is needed to switch between Expo Go and the dev build.
