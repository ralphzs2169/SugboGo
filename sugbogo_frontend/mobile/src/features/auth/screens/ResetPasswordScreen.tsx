import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler, View } from "react-native";
import Toast from "react-native-toast-message";

import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import {
  ResetPasswordErrors,
  validateResetPasswordForm,
} from "@/features/auth/utils/resetPasswordValidator";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import PasswordInput from "@/shared/components/form/PasswordInput";
import { handleSystemError } from "@/shared/utils/apiErrors";

const MASCOT_RESET_PASSWORD = require("@/shared/assets/mascot/mascot-reset-password.webp");

/**
 * Displays the password reset screen and coordinates creation of a new password.
 *
 * Handles validation, reset-link errors, password updates, and navigation back
 * to the login flow after the reset process.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [formError, setFormError] = useState("");

  const { uid, token } = useLocalSearchParams<{
    uid: string;
    token: string;
  }>();

  const { handleResetPassword, loading } = useResetPassword();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.replace("/(auth)/login");
          return true;
        },
      );

      return () => subscription.remove();
    }, [router]),
  );

  const clearFieldError = (field: "password" | "confirmPassword") => {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setFormError("");
  };

  const onResetPassword = async () => {
    if (loading) {
      return;
    }

    const validationErrors = validateResetPasswordForm(
      password,
      confirmPassword,
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    if (!uid || !token) {
      setFormError("Invalid password reset link. Please request a new one.");
      return;
    }

    try {
      const response = await handleResetPassword(
        uid.toString(),
        token.toString(),
        password,
      );

      if (!response.success) {
        const passwordError = response.errors?.password?.[0];

        if (passwordError) {
          setErrors({
            password: passwordError,
          });

          return;
        }

        if (handleSystemError(response)) {
          return;
        }

        setFormError(response.message);
        return;
      }

      router.replace("/(auth)/password-reset-success");
    } catch (error) {
      console.error("Unexpected reset password error:", error);

      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <AuthLayout>
      {/* Password reset mascot */}
      <View className="mb-6 items-center justify-center">
        <Image
          source={MASCOT_RESET_PASSWORD}
          style={{
            width: 170,
            height: 170,
          }}
          contentFit="contain"
          accessible={false}
        />
      </View>

      {/* Password reset introduction */}
      <View className="mb-7">
        <AppText
          weight="bold"
          className="text-center text-xl text-text-primary"
        >
          Reset your password
        </AppText>

        <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
          Create a new password to secure your account.
        </AppText>
      </View>

      {/* Reset form error */}
      {formError ? (
        <View className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <View className="flex-row items-start">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color="#DC2626"
            />

            <AppText
              weight="medium"
              className="ml-2 flex-1 text-sm leading-5 text-text-error"
            >
              {formError}
            </AppText>
          </View>
        </View>
      ) : null}

      {/* Password fields */}
      <View className="gap-1">
        <PasswordInput
          label="NEW PASSWORD"
          placeholder="Enter your new password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          onFocus={() => clearFieldError("password")}
        />

        <PasswordInput
          label="CONFIRM PASSWORD"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          onFocus={() => clearFieldError("confirmPassword")}
        />
      </View>

      {/* Reset action */}
      <Button
        title="Reset password"
        onPress={onResetPassword}
        loading={loading}
        disabled={loading}
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
        marginTop={0}
      />
    </AuthLayout>
  );
}
