import Toast from "react-native-toast-message";
import { Alert } from "react-native";
import type { ApiError } from "@/shared/types/apiResponse.types";

/** Keeps account recovery instructions visible after provider sign-in ends. */
export function showOAuthError(
  provider: "Google" | "Facebook",
  error?: ApiError,
  recover?: () => void,
) {
  if (error?.code === "OAUTH_LINK_REQUIRED") {
    Alert.alert(
      `Continue without ${provider}`,
      error.message,
      [
        { text: "Close", style: "cancel" },
        { text: "Forgot password", onPress: recover },
      ],
    );
    return;
  }

  if (error?.code === "ACCOUNT_INACTIVE" || error?.code === "OAUTH_LOGIN_DENIED") {
    Alert.alert(`Couldn't sign in with ${provider}`, error.message);
    return;
  }

  Toast.show({
    type: "error",
    text1: `Couldn't sign in with ${provider}`,
  });
}
