import Toast from "react-native-toast-message";

export function showOAuthError(provider: "Google" | "Facebook") {
  Toast.show({
    type: "error",
    text1: `Couldn't sign in with ${provider}`,
  });
}
