import { useState } from "react";
import { router } from "expo-router";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { LoginManager, AccessToken } from "react-native-fbsdk-next";

import { facebookLogin } from "../api/auth.service";
import { establishSession } from "../utils/authSession";

/**
 * Handles Facebook OAuth login.
 *
 * Authenticates the user with Facebook, exchanges the Facebook
 * access token with the backend, establishes the local session,
 * and navigates to the home screen.
 */
export function useFacebookLogin() {
  const [loading, setLoading] = useState(false);

  /**
   * Starts the Facebook login flow.
   */
  async function handleFacebookLogin() {
    setLoading(true);

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
        Toast.show({
          type: "error",
          text1: "Facebook Sign-In Failed",
          text2: "Unable to retrieve your Facebook credentials.",
        });

        return;
      }

      const response = await facebookLogin(token.accessToken.toString());

      await establishSession(response.data);

      router.replace("/");
    } catch (error) {
      console.log("Facebook login error:", error);

      Toast.show({
        type: "error",
        text1: "Facebook Sign-In Failed",
        text2: "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return {
    handleFacebookLogin,
    loading,
  };
}
