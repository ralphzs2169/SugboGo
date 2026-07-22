# SugboGo Mobile

The SugboGo mobile application is built with **React Native** and **Expo**. It allows users to discover hidden gems and MSMEs across Cebu, manage their accounts, and access location-based features.

## Tech Stack

- React Native
- Expo
- TypeScript
- Expo Router

## Mobile Folder Structure

```text
mobile/
│
├── src/
│   │
│   ├── app/                         # Expo Router file-based navigation
│   │   ├── (auth)/                  # Authentication screens (login, register, password reset)
│   │   ├── (explorer)/              # Main application screens and tab navigation
│   │   ├── (setup)/                 # Initial user setup flows
│   │   ├── oauthredirect.tsx        # OAuth redirect handler
│   │   └── _layout.tsx              # Root navigation layout
│   │
│   ├── features/                    # Feature-based application modules
│   │   │
│   │   ├── auth/                    # Authentication feature
│   │   │   ├── api/                 # Authentication API services and types
│   │   │   ├── components/          # Authentication UI components
│   │   │   ├── hooks/               # Authentication hooks (login, logout, OAuth, verification)
│   │   │   ├── oauth/               # OAuth provider integrations
│   │   │   ├── store/               # Authentication state management
│   │   │   └── utils/               # Validation and authentication helpers
│   │   │
│   │   │   # Other features follow the same internal structure as auth
│   │   ├── onboarding/              # User onboarding flow
│   │   ├── interest-selection/      # User interest selection feature
│   │   └── profile/                 # User profile feature           
│   │
│   ├── shared/                      # Shared resources across features
│   │   ├── api/                     # Axios client, API helpers, token handling
│   │   ├── components/              # Reusable application components
│   │   └── services/                # Shared services (storage, utilities)
│   │
│   ├── assets/                      # Application images, icons, and static assets
│   │
│   ├── config/                      # Application configuration
│   │   ├── env.ts                   # Environment variable handling
│   │   └── oauth.ts                 # OAuth configuration
│   │
│   ├── constants/                   # Global constants (theme, colors, spacing)
│   │
│   └── types/                       # Global TypeScript type definitions
│
├── assets/                          # Expo assets (icons, splash screen, images)
│
├── app.json                         # Expo application configuration
├── package.json                     # Node dependencies and scripts
├── tailwind.config.js               # NativeWind/Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Mobile setup documentation
```
## Requirements

Install the following before setting up the project:

- Node.js (LTS recommended)
- Git
- Android Studio (optional, for emulator)
- An Android device (recommended for testing)

## 1.) Navigate to Mobile Application

From the project root:

```bash
cd sugbogo_frontend/mobile
```

Install the project dependencies:

```bash
npm install
```

## 2.) Configure Environment Variables

Copy the example environment file.

**Windows (PowerShell)**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Update the values in `.env` before running the application.

### 3.) API Configuration

Replace `YOUR_LOCAL_IP` with the local IP address of the machine running the Django backend.

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8000/api
```

#### 3.1) How to find Local IP Address (Windows)

Run:

```powershell
ipconfig
```

Locate the **IPv4 Address** of your active network adapter.

Example:

```text
IPv4 Address . . . . . . . . . . : 192.168.1.100
```

Update `.env` accordingly:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000/api
```

> **Note**
>
> Your mobile device and the computer running the Django backend must be connected to the same local network.
---



### 4.) OAuth Configuration

If you plan to test Google or Facebook login, configure the OAuth credentials in **both** the mobile and backend `.env` files.

#### Mobile (`sugbogo_frontend/mobile/.env`)

```env
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

EXPO_PUBLIC_FACEBOOK_APP_ID=
EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN=
```

#### Backend (`sugbogo_backend/.env`)

```env
GOOGLE_OAUTH_CLIENT_ID=

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

> **Note**
>
> OAuth login requires both the mobile application and the Django backend to be configured with the appropriate credentials. If either configuration is missing, Google and Facebook login will not function correctly.

---
## 5.) Connect to Backend

If you are testing on a **physical Android device**, start the Django backend using:

```bash
python manage.py runserver 0.0.0.0:8000
```

This allows other devices on your local network to access the backend.

If you are using an **Android emulator**, the default command is sufficient:

```bash
python manage.py runserver
```

## 6.) Run the Application

SugboGo can be run using either **Expo Go** or a **Development Build**.

#### Option 1: Expo Go (Limited features)

Start the Expo development server:

```bash
npx expo start
```

Then scan the QR code using the Expo Go app.

> **Limitations**
>
> Expo Go can be used to test most application features, including standard API requests such as email/password login. However, it **does not support native modules** used by SugboGo, so the following features cannot be tested:
>
> - Google OAuth
> - Facebook OAuth
> - Deep Linking
>
> Deep linking allows external links (such as email verification and password reset links) to automatically open the SugboGo mobile application after the user taps the link.

> **Note**
>
> During development:
>
> - Google OAuth may require your Google account to be added as a test user in the Google Cloud Console.
> - Facebook Login only works for users assigned a role (Administrator, Developer, Tester, or Test User) in the Facebook Developer Console while the app is in Development Mode.
> - so e send lang niya sa gc inyo account para ma add nako



#### Option 2: Development Build (Recommended)

A **Development Build** is a custom version of the Expo application that includes the native modules required by SugboGo. Unlike Expo Go, it behaves much closer to the final production application while still supporting fast development with Metro.

A development build is required to test:

- Google OAuth
- Facebook OAuth
- Deep Linking
- Any other native functionality added to the project

### 6.1) Install the Development Build

#### Option 1: Request APK (Recommended)

Request the latest SugboGo development APK from miguel and install it on your Android device.

After installing the APK, start the development server:

```bash
npx expo start --dev-client
```

Open the installed **SugboGo** development application and connect to the Metro server by scanning the QR code.

#### Option 2: Build Your Own Development APK

Building your own development APK is only recommended if one is not already available, as it requires additional setup and build time.

```bash
npx expo run:android
```

or

```bash
eas build --profile development --platform android
```

---

## 7.) Installing the APK

#### Option 1: Physical Android Device

1. Download or obtain the latest SugboGo development APK. 
2. Transfer the APK to your Android device.
3. Open the APK and install it.
4. If prompted, allow installation from unknown sources.
5. Launch the **SugboGo** application.
6. Start the Metro development server:

```bash
npx expo start --dev-client
```

7. Scan the QR code displayed in the terminal or browser to connect to the development server.

---

### Option 2: Android Emulator

1. Start the Android Emulator from **Android Studio > Device Manager**.
2. Download the SugboGo development APK to your computer.
3. Install the APK using one of the following methods:
   - **Drag and drop** the APK onto the emulator window, **or**
   - Run in mobile directory:

```bash
adb install "path\to\application.apk"
```

If the application is already installed, use:

```bash
adb install -r "path\to\application.apk"
```

4. Open the installed **SugboGo** application from the emulator's app drawer.
   > -
   > **Can't find the app?**
   >
   > - Open the emulator's app drawer and look for **SugboGo** or **mobile** (older development builds may still use the name `mobile`).
   > - If the app is still not visible, verify that it was installed successfully:
   >
   > ```bash
   > adb shell pm list packages | findstr sugbogo
   > ```
   >
   > If the package appears, launch it manually:
   >
   > ```bash
   > adb shell monkey -p com.sugbogo.app -c android.intent.category.LAUNCHER 1
   > ```
   >
   > If the package is not listed, reinstall the APK.
5. Start the Metro development server:

```bash
npx expo start --dev-client
```

6. The development client should automatically connect to the Metro server. If it does not, open the developer menu and manually connect to the development server.