import { router } from "expo-router";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import AuthSuccessScreen from "@/features/auth/components/AuthSuccessScreen";

export default function EmailVerifiedScreen() {
  return (
    <AuthSuccessScreen
      paddingTop={24}
      animation={successAnimation}
      title="Email verified"
      description="Your email has been successfully verified. You can now log in to your SugboGo account."
      buttonTitle="Log in"
      onPress={() => router.replace("/(auth)/login")}
    />
  );
}
