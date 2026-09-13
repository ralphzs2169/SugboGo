import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useForgotPassword } from "@/features/auth/hooks/useForgotPassword";
import { validateForgotPasswordForm } from "@/features/auth/utils/forgotPasswordValidator";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";

const MASCOT_FORGOT_PASSWORD = require("@/shared/assets/mascot/mascot-forgot-password.webp");

/**
 * Displays the password recovery screen and coordinates reset-link requests.
 *
 * Handles email validation, rate-limit feedback, reset-link delivery, and
 * navigation back to the login flow.
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
    if (loading) {
      return;
    }

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

        const emailError = getFieldError(response, "email");

        if (emailError) {
          setErrors({
            email: emailError,
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
      {/* Password recovery mascot */}
      <View className="mb-6 items-center justify-center">
        <Image
          source={MASCOT_FORGOT_PASSWORD}
          style={{
            width: 170,
            height: 170,
          }}
          contentFit="contain"
          accessible={false}
        />
      </View>

      {/* Password recovery introduction */}
      <View className="mb-7">
        <AppText
          weight="bold"
          className="text-center text-xl text-text-primary"
        >
          Forgot your password?
        </AppText>

        <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </AppText>
      </View>

      {/* Email field */}
      <FormInput
        label="EMAIL ADDRESS"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        onFocus={clearEmailError}
      />

      {/* Reset action */}
      <Button
        title="Send reset link"
        loading={loading}
        disabled={loading}
        onPress={onSendResetLink}
        className="mb-6 mt-5"
        textWeight="bold"
        rounded="full"
      />

      {/* Back navigation */}
      <BottomAuthLink
        text=""
        actionText="Back to log in"
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
