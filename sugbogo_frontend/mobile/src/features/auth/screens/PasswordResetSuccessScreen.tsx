import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import PasswordResetSuccessIcon from "@/features/auth/assets/icons/password-reset-success.svg";

/**
 * Screen displayed after a user successfully resets their password.
 *
 * Confirms that the password has been updated and provides a
 * single action for returning to the login screen.
 */
export default function PasswordResetSuccessScreen() {
  const router = useRouter();

  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <PasswordResetSuccessIcon width={180} height={180} />
      </View>

      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Password Updated
      </Text>

      <Text className="mb-10 text-center text-base text-text-secondary">
        Your password has been updated successfully. You can now sign in using
        your new password.
      </Text>

      <AuthButton
        title="Sign In"
        onPress={() => router.replace("/(auth)/login")}
        icon={<MaterialCommunityIcons name="login" size={20} color="white" />}
      />
    </AuthLayout>
  );
}
