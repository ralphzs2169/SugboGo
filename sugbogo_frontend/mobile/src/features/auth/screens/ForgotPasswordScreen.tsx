import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";
import { validateForgotPasswordForm } from "@/features/auth/utils/forgotPasswordValidator";
import { handleSystemError } from "@/shared/api/errors";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import Toast from "react-native-toast-message";
import ForgotPasswordIllustration from "@/features/auth/assets/icons/forgot-password.svg";
import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import FormInput from "@/features/auth/components/FormInput";

/**
 * Screen that allows users to request a password reset link.
 *
 * Validates the email address, sends a reset request,
 * and redirects users to the reset confirmation screen.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();

  const { handleForgotPassword, loading } = useForgotPassword();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string }>({});

  const clearEmailError = () => {
    setErrors({});
  };

  const onSendResetLink = async () => {
    if (loading) return;

    const validationErrors = validateForgotPasswordForm(email);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    try {
      const response = await handleForgotPassword(email);

      if (!response.success) {
        if (response.code === "RATE_LIMIT_EXCEEDED") {
          const retryAfter = response.errors?.retry_after as number | undefined;

          Toast.show({
            type: "error",
            text1: getRetryAfterMessage(retryAfter),
          });

          return;
        }

        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to send reset link.",
        });

        return;
      }

      router.push({
        pathname: "/(auth)/reset-link-sent",
        params: {
          email,
        },
      });
    } catch (error) {
      console.error("Unexpected forgot password error:", error);

      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <AuthLayout>
      <View className="mb-6 items-center justify-center">
        <ForgotPasswordIllustration width={150} height={150} />
      </View>
      <Text className="mb-4 text-center text-3xl font-bold text-text-primary">
        Forgot Password
      </Text>

      <Text className="mb-8 text-center text-base text-text-secondary">
        Enter your email address and we'll send you a link to reset your
        password.
      </Text>

      <FormInput
        label="EMAIL ADDRESS"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        onFocus={() => clearEmailError()}
      />

      <AuthButton
        title="Send Reset Link"
        loading={loading}
        onPress={onSendResetLink}
        icon={
          <MaterialCommunityIcons
            name="email-outline"
            size={20}
            color="white"
          />
        }
      />

      <BottomAuthLink
        text=""
        actionText="Back to Login"
        icon={
          <MaterialIcons
            name="arrow-back"
            size={20}
            color="#F27F0D"
            style={{ marginRight: 4 }}
          />
        }
        onPress={() => router.replace("/(auth)/login")}
      />
    </AuthLayout>
  );
}
