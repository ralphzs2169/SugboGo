import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import AuthHeader from "@/features/auth/components/AuthHeader";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import Divider from "@/features/auth/components/Divider";
import SocialLoginButtons from "@/features/auth/components/SocialLoginButtons";
import { useFacebookLogin } from "@/features/auth/hooks/useFacebookLogin";
import { useGoogleLogin } from "@/features/auth/hooks/useGoogleLogin";
import { useRegister } from "@/features/auth/hooks/useRegister";
import getRegisterErrors from "@/features/auth/utils/registerErrors";
import {
  RegisterErrors,
  validateRegisterForm,
} from "@/features/auth/utils/registerValidator";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import PasswordInput from "@/shared/components/form/PasswordInput";
import { handleSystemError } from "@/shared/utils/apiErrors";

/**
 * Displays the Explorer registration screen and coordinates credential,
 * Google, and Facebook account creation flows.
 *
 * Handles client and server validation, account creation, and the transition
 * into email verification while keeping credential signup visually primary.
 */
export default function RegisterScreen() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState("");

  const { handleRegister, loading } = useRegister();
  const { handleGoogleLogin } = useGoogleLogin();
  const { handleFacebookLogin } = useFacebookLogin();

  const clearFieldError = (field: keyof RegisterErrors) => {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setFormError("");
  };

  const onRegister = async () => {
    if (loading) {
      return;
    }

    const validationErrors = validateRegisterForm(
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    );

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    try {
      const response = await handleRegister(
        firstName,
        lastName,
        email,
        password,
      );

      if (!response.success) {
        const registerErrors = getRegisterErrors(response);

        if (
          registerErrors.firstName ||
          registerErrors.lastName ||
          registerErrors.email ||
          registerErrors.password
        ) {
          setErrors(registerErrors);
          return;
        }

        if (handleSystemError(response)) {
          return;
        }

        setFormError(response.message);
        return;
      }

      router.replace("/(auth)/verify-email");
    } catch (error) {
      console.error("Unexpected registration error:", error);

      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <AuthLayout paddingTop={64}>
      {/* Brand header */}
      <AuthHeader />

      {/* Registration introduction */}
      <AppText weight="bold" className="mb-7 text-xl text-text-primary">
        Create your account
      </AppText>

      {/* Registration fields */}
      <View className="gap-1">
        <FormInput
          label="FIRST NAME"
          placeholder="Enter your first name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          onFocus={() => clearFieldError("firstName")}
          error={errors.firstName}
        />

        <FormInput
          label="LAST NAME"
          placeholder="Enter your last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          onFocus={() => clearFieldError("lastName")}
          error={errors.lastName}
        />

        <FormInput
          label="EMAIL ADDRESS"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          onFocus={() => clearFieldError("email")}
          error={errors.email}
        />

        <PasswordInput
          label="PASSWORD"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          onFocus={() => clearFieldError("password")}
        />

        <PasswordInput
          label="CONFIRM PASSWORD"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          onFocus={() => clearFieldError("confirmPassword")}
        />
      </View>

      {/* Registration error */}
      {formError ? (
        <View className="mt-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
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

      {/* Primary registration action */}
      <Button
        title="Create account"
        loading={loading}
        disabled={loading}
        onPress={onRegister}
        className="mb-6 mt-5"
        textWeight="bold"
        rounded="full"
      />

      {/* Alternative authentication */}
      <Divider text="or continue with" />

      <SocialLoginButtons
        disabled={loading}
        onGooglePress={handleGoogleLogin}
        onFacebookPress={handleFacebookLogin}
      />

      {/* Login action */}
      <View className="mt-6">
        <BottomAuthLink
          text="Already have an account?"
          actionText="Log in"
          onPress={() => router.push("/(auth)/login")}
        />
      </View>
    </AuthLayout>
  );
}
