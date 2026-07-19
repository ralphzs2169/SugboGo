# SugboGo Mobile Setup Guide (Google OAuth Development Build)

## Assumptions

Before starting, ensure you have:

- Git installed
- Node.js installed
- An Android phone
- The `sugbogo_frontend/mobile` project

---

# 1. Pull the Latest Changes

Navigate to the mobile project:

```bash
cd sugbogo_frontend/mobile
```

Pull the latest code:

```bash
git pull origin main
```

> Replace `main` with your current branch if necessary.

---

# 2. Install Dependencies

Install all project dependencies:

```bash
npm install
```

This installs:

- Expo dependencies
- `expo-router`
- `expo-auth-session`
- `expo-dev-client`
- Other project packages

---

# 3. Verify Expo Configuration

Open **app.json** and ensure it contains:

```json
{
  "expo": {
    "scheme": "sugbogo",
    "android": {
      "package": "com.sugbogo.app"
    }
  }
}
```

> **Do not change the Android package name.**

It **must** remain:

```text
com.sugbogo.app
```

Google OAuth is configured specifically for this package.

---

# 4. Install EAS CLI

If EAS CLI is not installed:

```bash
npm install -g eas-cli
```

Verify the installation:

```bash
eas --version
```

> npm warnings are generally okay unless the installation fails.

---

# 5. Log In to Expo

Log in using your Expo account:

```bash
eas login
```

You may use your own Expo account.

---

# 6. Install the Android Development Build

You need the **SugboGo Development APK**.

## Option A (Recommended)

A teammate provides the latest development APK.

1. Download the APK.
2. Install it on your phone.
3. Open it once.

## Option B

Build your own development APK:

```bash
eas build --profile development --platform android
```

After the build finishes:

1. Download the APK.
2. Install it on your Android phone.

---

# 7. Start the Development Server

Run:

```bash
npx expo start --dev-client
```

You should see output similar to:

```text
Starting Metro Bundler
› Press a │ open Android
```

---

# 8. Connect the Development Build

On your Android phone, open:

✅ **SugboGo Development**

Do **not** open:

❌ **Expo Go**

The development build should automatically connect to Metro.

---

# 9. Configure Environment Variables

Create or update your `.env` file.

Example:

```env
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:8000/api

EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
```

## Important

Do **not** use:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000/api
```

Your phone cannot access your computer's `localhost`.

Instead, use your computer's LAN IP.

Example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api
```

---

# 10. Restart Expo After `.env` Changes

Whenever `.env` changes:

Stop Metro:

```text
CTRL + C
```

Restart it:

```bash
npx expo start --dev-client -c
```

The `-c` flag clears the Metro cache.

---

# 11. Test Google Login

Open the **SugboGo Development** app.

Navigate through:

```text
Login
   ↓
Continue with Google
   ↓
Choose Google Account
```

Expected flow:

```text
Google Account Picker
        ↓
Return to SugboGo
        ↓
Google Auth Response
```

Example response:

```json
{
  "type": "success",
  "params": {
    "code": "..."
  }
}
```

---

# Important Notes

## Do Not Use Expo Go

Use:

- ✅ SugboGo Development APK

Do not use:

- ❌ Expo Go

### Why?

Expo Go has a different Android application identity and is **not** registered with Google OAuth.

---

## Do Not Run

```bash
npx expo run:android
```

unless you understand native Android configuration.

Instead, use:

```bash
eas build --profile development --platform android
```

---

# Troubleshooting Google Login

If Google Login fails, check the following:

## 1. Development APK

Ensure you installed the **latest** development APK.

Older builds may not include:

```text
com.sugbogo.app:/oauthredirect
```

---

## 2. Correct Application

Verify that you're opening:

✅ SugboGo Development

Not:

❌ Expo Go

---

## 3. Latest Source Code

Check that you've pulled the latest changes:

```bash
git log -1
```

Verify the latest commit contains the OAuth implementation.

---

# Recommended Team Workflow

For normal development:

```text
git pull
    │
npm install
    │
npx expo start --dev-client
    │
Open SugboGo Development APK
```

---

# When to Rebuild the Development APK

Only rebuild when there are **native** changes, such as:

- ✅ Android package name changes
- ✅ Google OAuth configuration changes
- ✅ Android permission changes
- ✅ Native plugins added
- ✅ Expo config plugin changes

For normal JavaScript or TypeScript changes:

- ❌ No rebuild required
- ✅ Simply restart Metro if needed

---

This should be the standard workflow for the team until the production build is introduced.