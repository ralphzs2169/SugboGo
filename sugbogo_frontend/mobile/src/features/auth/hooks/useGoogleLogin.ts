import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";

import { useGoogleAuth } from "../oauth/google";
import { googleLogin } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import type { TokenResponse } from "expo-auth-session";
import { Toast } from "react-native-toast-message/lib/src/Toast";

export function useGoogleLogin() {
  const [request, response, promptAsync] = useGoogleAuth();

  const [loading, setLoading] = useState(false);
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

  /**
   * Authenticates the user with the backend using the Google ID token.
   *
   * @param {TokenResponse} authentication - The authentication response from Google.
   */
  async function authenticate(authentication: TokenResponse) {
    setLoading(true);

    try {
      const idToken = authentication.idToken;

      if (!idToken) {
        if (!idToken) {
          Toast.show({
            type: "error",
            text1: "Google Sign-In Failed",
            text2: "Unable to retrieve your Google credentials.",
          });

          return;
        }
      }

      const result = await googleLogin(idToken);
      await establishSession(result.data);

      router.replace("/");
    } catch (error) {
      console.log("Google login error:", error);
    } finally {
      setLoading(false);
    }
  }

  return {
    handleGoogleLogin: () => promptAsync(),
    loading: loading || !request,
  };
}
