import { router } from "expo-router";

import successAnimation from "@/shared/assets/animations/success-confetti.json";
import AuthSuccessScreen from "@/features/auth/components/AuthSuccessScreen";

export default function PasswordResetSuccessScreen() {
  return (
    <AuthSuccessScreen
      animation={successAnimation}
      title="Password Updated"
      description="Your password has been updated successfully. You can now sign in using your new password."
      buttonTitle="Sign In"
      onPress={() => router.replace("/(auth)/login")}
    />
  );
}
