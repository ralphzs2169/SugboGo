import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { useResetPassword } from "@/features/auth/hooks/useResetPassword";
import {
  validateResetPasswordForm,
  ResetPasswordErrors,
} from "@/features/auth/utils/resetPasswordValidator";
import { handleSystemError } from "@/shared/api/errors";

import ResetPasswordIcon from "@/features/auth/assets/icons/reset-password.svg";
import AuthButton from "@/features/auth/components/AuthButton";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import PasswordInput from "@/features/auth/components/PasswordInput";

/**
 * Screen responsible for allowing users to reset their password.
 *
 * Validates the new password inputs, submits the password reset request,
 * handles validation and system errors, and redirects users back to login
 * after a successful password update.
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

  const clearFieldError = (field: "password" | "confirmPassword") => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  const onResetPassword = async () => {
    if (loading) return;

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
      <View className="mb-6 items-center justify-center">
        <ResetPasswordIcon width={150} height={150} />
      </View>

      <Text className="mb-2 text-center text-3xl font-bold text-text-primary">
        Reset Password
      </Text>

      <Text className="mb-8 text-center text-base text-text-secondary">
        Create a new password for your account.
      </Text>

      {formError ? (
        <Text className="mb-4 text-center text-sm font-semibold text-error">
          {formError}
        </Text>
      ) : null}

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

      <AuthButton
        title="Reset Password"
        loading={loading}
        onPress={onResetPassword}
        icon={
          <MaterialCommunityIcons name="key-outline" size={20} color="white" />
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
        marginTop={0}
      />
    </AuthLayout>
  );
}
