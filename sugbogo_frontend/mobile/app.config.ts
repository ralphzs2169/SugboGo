import { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "SugboGo",
  slug: "sugbogo",
  version: "1.0.0",

  orientation: "portrait",

  icon: "./assets/images/sugbogo-logo.png",

  scheme: ["sugbogo", "com.sugbogo.app"],

  userInterfaceStyle: "automatic",

  ios: {
    icon: "./assets/expo.icon",
  },

  android: {
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/sugbogo-logo.png",
    },

    predictiveBackGestureEnabled: false,

    package: "com.sugbogo.app",
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },

  plugins: [
    "expo-router",

    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/images/sugbogo-logo.png",
        imageWidth: 76,
      },
    ],
    "expo-secure-store",
    "expo-image",
    "expo-image-picker",
    "expo-status-bar",
    "expo-web-browser",

    [
      "react-native-fbsdk-next",
      {
        appID: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "000000000000000",
        displayName: "SugboGo",
        clientToken:
          process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN || "placeholder_token",
        scheme: `fb${process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "000000000000000"}`,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    router: {},

    eas: {
      projectId: "02708995-d201-44c3-af34-1d1fb92ed2d0",
    },
  },

  owner: "ralphskie",
});
