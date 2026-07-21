import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { useGoogleAuth } from "../oauth/google";
import { googleLogin } from "../api/auth.service";
import { establishSession } from "../utils/authSession";
import type { TokenResponse } from "expo-auth-session";
import { useAuthStore } from "../store/auth.store";

export function useGoogleLogin() {
  const [request, response, promptAsync] = useGoogleAuth();

  const handledResponse = useRef(false);

  useEffect(() => {
    console.log("Google response:", response?.type);

    if (
      !response ||
      response.type !== "success" ||
      !response.authentication ||
      handledResponse.current
    ) {
      return;
    }

    handledResponse.current = true;

    console.log("Calling authenticate");

    authenticate(response.authentication);
  }, [response]);

  async function authenticate(authentication: TokenResponse) {
    console.log("Entered authenticate");

    const setSigningIn = useAuthStore.getState().setSigningIn;

    setSigningIn(true);

    try {
      const idToken = authentication.idToken;

      if (!idToken) {
        Toast.show({
          type: "error",
          text1: "Google Sign-In Failed",
          text2: "Unable to retrieve your Google credentials.",
        });

        router.replace("/(auth)/login");

        return;
      }

      const result = await googleLogin(idToken);

      console.log("Google login result:", result);

      if (!result.success) {
        Toast.show({
          type: "error",
          text1: "Google Sign-In Failed",
          text2: result.message,
        });

        router.replace("/(auth)/login");

        return;
      }

      await establishSession(result.data);

      router.replace("/");
    } catch (error) {
      console.error("Unexpected Google login error:", error);

      Toast.show({
        type: "error",
        text1: "Google Sign-In Failed",
        text2: "Something unexpected happened. Please try again.",
      });

      router.replace("/(auth)/login");
    } finally {
      setSigningIn(false);
    }
  }

  return {
    handleGoogleLogin: () => promptAsync(),
  };
}
