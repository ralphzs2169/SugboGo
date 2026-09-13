import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

import AuthHeader from "@/features/auth/components/AuthHeader";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import Divider from "@/features/auth/components/Divider";
import SocialLoginButtons from "@/features/auth/components/SocialLoginButtons";
import { useFacebookLogin } from "@/features/auth/hooks/useFacebookLogin";
import { useGoogleLogin } from "@/features/auth/hooks/useGoogleLogin";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import {
  LoginErrors,
  validateLoginForm,
} from "@/features/auth/utils/loginValidator";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import PasswordInput from "@/shared/components/form/PasswordInput";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

/**
 * Displays the Explorer login screen and coordinates credential, Google,
 * and Facebook authentication flows.
 *
 * Handles validation, verification redirects, rate-limit feedback, and
 * session-expiration recovery while keeping the primary login action visually
 * distinct from secondary social authentication.
 */
export default function LoginScreen() {
  const router = useRouter();

  const setPendingEmail = useVerificationStore(
    (state) => state.setPendingEmail,
  );

  const sessionExpired = useAuthStore((state) => state.sessionExpired);
  const setSessionExpired = useAuthStore((state) => state.setSessionExpired);
  const signingIn = useAuthStore((state) => state.isSigningIn);

  const [navigating, setNavigating] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState("");

  const { handleLogin, loading } = useLogin();
  const { handleGoogleLogin } = useGoogleLogin();
  const { handleFacebookLogin } = useFacebookLogin();

  const isRateLimited = retryAfter > 0;
  const isAuthenticating = loading || navigating || signingIn;
  const isLoginDisabled = isAuthenticating || isRateLimited;

  useEffect(() => {
    if (!sessionExpired) {
      return;
    }

    setFormError("Your session has expired. Please sign in again.");
    setSessionExpired(false);
  }, [sessionExpired, setSessionExpired]);

  useEffect(() => {
    if (retryAfter <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRetryAfter((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfter]);

  useEffect(() => {
    if (retryAfter === 0 && formError.startsWith("Too many login attempts.")) {
      setFormError("");
    }
  }, [retryAfter, formError]);

  const clearFieldError = (field: keyof LoginErrors) => {
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    if (!isRateLimited) {
      setFormError("");
    }
  };

  const onLogin = async () => {
    if (isLoginDisabled) {
      return;
    }

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

        if (response.code === "RATE_LIMIT_EXCEEDED") {
          const seconds = Number(response.errors?.retry_after ?? 0);

          setRetryAfter(seconds);

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

  if (signingIn) {
    return (
      <LoadingScreen
        title="Signing you in..."
        description="Please wait while we securely sign you in."
      />
    );
  }

  return (
    <AuthLayout>
      {/* Brand header */}
      <AuthHeader />

      {/* Login introduction */}

      <AppText weight="bold" className="mb-7 text-xl text-text-primary">
        Log in to your account
      </AppText>

      {/* Credential fields */}
      <View className="gap-1">
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
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              className="cursor-pointer"
            >
              <AppText
                weight="semibold"
                className="text-xs tracking-[0.3px] text-brand"
              >
                Forgot?
              </AppText>
            </TouchableOpacity>
          }
        />
      </View>

      {/* Login error */}
      {isRateLimited ? (
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
              Too many login attempts. Please try again in {retryAfter} seconds.
            </AppText>
          </View>
        </View>
      ) : formError ? (
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

      {/* Primary login action */}
      <Button
        title="Log in"
        loading={isAuthenticating}
        disabled={isLoginDisabled}
        onPress={onLogin}
        className="mb-6 mt-5"
        textWeight="bold"
        rounded="full"
      />

      {/* Alternative authentication */}
      <Divider text="or continue with" />

      <View className="">
        <SocialLoginButtons
          disabled={isLoginDisabled}
          onGooglePress={handleGoogleLogin}
          onFacebookPress={handleFacebookLogin}
        />
      </View>

      {/* Registration action */}
      <View className="mt-6">
        <BottomAuthLink
          text="New to SugboGo?"
          actionText="Create an account"
          onPress={() => router.push("/(auth)/register")}
        />
      </View>
    </AuthLayout>
  );
}
