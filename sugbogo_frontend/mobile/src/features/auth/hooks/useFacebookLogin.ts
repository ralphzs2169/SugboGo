import { router } from "expo-router";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { LoginManager, AccessToken } from "react-native-fbsdk-next";

import { facebookLogin } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import { useAuthStore } from "../store/auth.store";
import { showOAuthError } from "../utils/oauthError";
/**
 * Handles Facebook OAuth login.
 *
 * Authenticates the user with Facebook, exchanges the Facebook
 * access token with the backend, establishes the local session,
 * and navigates to the home screen.
 */
export function useFacebookLogin() {
  async function handleFacebookLogin() {
    const setSigningIn = useAuthStore.getState().setSigningIn;

    setSigningIn(true);

    try {
      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);

      if (result.isCancelled) {
        return;
      }

      const token = await AccessToken.getCurrentAccessToken();

      if (!token) {
        showOAuthError("Facebook");
        router.replace("/(auth)/login");
        return;
      }

      const response = await facebookLogin(token.accessToken.toString());

      if (!response.success) {
        showOAuthError("Facebook");
        router.replace("/(auth)/login");
        return;
      }

      await establishSession(response.data);

      router.replace("/");
    } catch (error) {
      console.error("Facebook login error:", error);

      showOAuthError("Facebook");
      router.replace("/(auth)/login");
    } finally {
      setSigningIn(false);
    }
  }

  return {
    handleFacebookLogin,
  };
}
