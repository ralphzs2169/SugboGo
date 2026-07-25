import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import type { TokenResponse } from "expo-auth-session";
import { googleLogin } from "../api/auth.service";
import { useGoogleAuth } from "../oauth/google";
import { useAuthStore } from "../store/auth.store";
import { establishSession } from "../utils/authSession";
import { showOAuthError } from "../utils/oauthError";

/**
 * Hook for handling the Google OAuth sign-in flow.
 *
 * Initiates Google authentication, processes the OAuth callback,
 * exchanges the Google ID token with the backend, establishes the
 * user session, and redirects based on the authentication result.
 */
export function useGoogleLogin() {
  const [request, response, promptAsync] = useGoogleAuth();

  const handledResponse = useRef(false);

  useEffect(() => {
    if (
      !response ||
      response.type !== "success" ||
      !response.authentication ||
      handledResponse.current
    ) {
      return;
    }

    handledResponse.current = true;

    authenticate(response.authentication);
  }, [response]);

  async function authenticate(authentication: TokenResponse) {
    const setSigningIn = useAuthStore.getState().setSigningIn;

    setSigningIn(true);

    try {
      const idToken = authentication.idToken;

      if (!idToken) {
        showOAuthError("Google");
        router.replace("/(auth)/login");
        return;
      }

      const result = await googleLogin(idToken);

      if (!result.success) {
        showOAuthError("Google");
        router.replace("/(auth)/login");
        return;
      }

      await establishSession(result.data);

      router.replace("/");
    } catch (error) {
      console.error("Unexpected Google login error:", error);
      showOAuthError("Google");
      router.replace("/(auth)/login");
    } finally {
      setSigningIn(false);
    }
  }

  return {
    handleGoogleLogin: () => promptAsync(),
  };
}
