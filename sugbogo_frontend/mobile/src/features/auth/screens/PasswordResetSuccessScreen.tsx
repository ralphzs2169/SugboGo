import { router } from "expo-router";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import AuthSuccessScreen from "@/features/auth/components/AuthSuccessScreen";

export default function PasswordResetSuccessScreen() {
  return (
    <AuthSuccessScreen
      animation={successAnimation}
      title="Password Updated"
      description="Sign in with your new password. If email setup is still required, request a fresh verification link from the sign-in screen."
      buttonTitle="Sign In"
      onPress={() => router.replace("/(auth)/login")}
    />
  );
}
