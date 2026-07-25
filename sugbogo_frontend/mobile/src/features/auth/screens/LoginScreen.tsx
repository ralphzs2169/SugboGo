import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity } from "react-native";

import { useLogin } from "@/features/auth/hooks/useLogin";
import {
  LoginErrors,
  validateLoginForm,
} from "@/features/auth/utils/loginValidator";

import { getFieldError } from "@/shared/api/errors";

import Button from "@/shared/components/Button";
import AuthHeader from "@/features/auth/components/AuthHeader";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import Divider from "@/features/auth/components/Divider";
import FormInput from "@/features/auth/components/FormInput";
import PasswordInput from "@/features/auth/components/PasswordInput";
import SocialLoginButtons from "@/features/auth/components/SocialLoginButtons";

import { useVerificationStore } from "@/features/auth/store/verification.store";
import { handleSystemError } from "@/shared/api/errors";
import { useFacebookLogin } from "@/features/auth/hooks/useFacebookLogin";
import { useGoogleLogin } from "@/features/auth/hooks/useGoogleLogin";
import { useAuthStore } from "@/features/auth/store/auth.store";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

export default function LoginScreen() {
  const router = useRouter();

  const setPendingEmail = useVerificationStore(
    (state) => state.setPendingEmail,
  );

  const [navigating, setNavigating] = useState(false);

  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const setSessionExpired = useAuthStore((state) => state.setSessionExpired);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");

  const { handleLogin, loading } = useLogin();
  const { handleGoogleLogin } = useGoogleLogin();
  const { handleFacebookLogin } = useFacebookLogin();

  /**
   * Shows a one-time message when the previous session expired.
   * The flag is cleared immediately so it won't appear again.
   */
  useEffect(() => {
    if (!sessionExpired) {
      return;
    }

    setFormError("Your session has expired. Please sign in again.");
    setSessionExpired(false);
  }, [sessionExpired, setSessionExpired]);

  const clearFieldError = (field: keyof LoginErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  const onLogin = async () => {
    if (loading || navigating) return;

    const validationErrors = validateLoginForm(email, password);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    try {
      const response = await handleLogin(email, password);

      if (!response.success) {
        if (response.code === "EMAIL_NOT_VERIFIED") {
          setPendingEmail(email);

          setNavigating(true);
          router.replace("/(auth)/verify-email");

          return;
        }

        const emailError = getFieldError(response, "email");
        const passwordError = getFieldError(response, "password");

        if (emailError || passwordError) {
          setErrors({
            email: emailError,
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

      setNavigating(true);
      router.replace("/");
    } catch (error) {
      console.error("Unexpected login error:", error);

      Toast.show({
        type: "error",
        text1: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <AuthLayout>
      <AuthHeader />
      <Text className="mb-8 text-[17px] font-bold text-text-primary">
        Login to your account
      </Text>

      <FormInput
        label="EMAIL ADDRESS"
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
        onFocus={() => clearFieldError("email")}
      />

      <PasswordInput
        label="PASSWORD"
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        onFocus={() => clearFieldError("password")}
        rightElement={
          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text className="text-xs font-bold tracking-[0.5px] text-brand">
              FORGOT?
            </Text>
          </TouchableOpacity>
        }
      />

      {formError ? (
        <Text className="text-sm font-semibold text-error">{formError}</Text>
      ) : null}

      <Button
        title="Login"
        loading={loading || navigating}
        onPress={onLogin}
        icon={<MaterialCommunityIcons name="login" size={20} color="white" />}
        className="mb-20 mt-2 shadow"
        fontClassName="text-md font-bold"
      />

      <Divider text="OR LOG IN WITH" />

      <SocialLoginButtons
        onGooglePress={handleGoogleLogin}
        onFacebookPress={handleFacebookLogin}
        onApplePress={() => {
          console.log("Apple Login");
        }}
      />

      <BottomAuthLink
        text="New to SugboGo?"
        actionText="Create an account"
        onPress={() => router.push("/(auth)/register")}
      />
    </AuthLayout>
  );
}
