import { router } from "expo-router";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import AuthSuccessScreen from "@/features/auth/components/AuthSuccessScreen";

export default function EmailVerifiedScreen() {
  return (
    <AuthSuccessScreen
      animation={successAnimation}
      title="Email Verified"
      description="Your email has been successfully verified. You can now sign in to your SugboGo account."
      buttonTitle="Sign In"
      onPress={() => router.replace("/(auth)/login")}
    />
  );
}
