import { useRouter } from "expo-router";
import { useState } from "react";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { Button, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  LoginErrors,
  validateLoginForm,
} from "@/features/auth/utils/loginValidator";
import { getFieldError } from "@/shared/api/errors";

import AuthButton from "@/features/auth/components/AuthButton";
import AuthHeader from "@/features/auth/components/AuthHeader";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import Divider from "@/features/auth/components/Divider";
import FormInput from "@/features/auth/components/FormInput";
import PasswordInput from "@/features/auth/components/PasswordInput";
import SocialLoginButtons from "@/features/auth/components/SocialLoginButtons";
import { useGoogleLogin } from "@/features/auth/hooks/useGoogleLogin";
import { useFacebookLogin } from "@/features/auth/hooks/useFacebookLogin";

/**
 * Login component provides a user interface for logging into the application.
 * It includes input fields for email and password, social login buttons, and navigation to the registration page.
 */
export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");

  const { handleLogin } = useLogin();
  const { handleGoogleLogin } = useGoogleLogin();
  const { handleFacebookLogin } = useFacebookLogin();

  const [loading, setLoading] = useState(false);

  const clearFieldError = (field: keyof LoginErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  const onLogin = async () => {
    if (loading) return;

    const validationErrors = validateLoginForm(email, password);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    setLoading(true);

    try {
      const response = await handleLogin(email, password);

      if (!response.success) {
        setLoading(false);

        if (response.code === "EMAIL_NOT_VERIFIED") {
          router.push({
            pathname: "/(auth)/verify-email",
            params: { email },
          });

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

        setFormError(response.message);
        return;
      }

      router.replace("/");
    } catch (error) {
      console.error("Unexpected login error:", error);

      setLoading(false);
      setFormError("Something unexpected happened. Please try again.");
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

      <AuthButton
        title="Login"
        loading={loading}
        onPress={onLogin}
        icon={<MaterialCommunityIcons name="login" size={20} color="white" />}
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
