import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = "com.sugbogo.app:/oauthredirect";

console.log("Explicit redirect:", redirectUri);

export function useGoogleAuth() {
  return Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });
}
