import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import EmailConfirmationLayout from "@/features/auth/components/EmailConfirmationLayout";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useVerifyEmail } from "@/features/auth/hooks/useVerifyEmail";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import { validateForgotPasswordForm } from "@/features/auth/utils/forgotPasswordValidator";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import PasswordInput from "@/shared/components/form/PasswordInput";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";

/** Verifies the email link after the user enters their existing password. */
export default function VerifyEmailScreen() {
  const { uid, token } = useLocalSearchParams();

  if (typeof uid === "string" && uid && typeof token === "string" && token) {
    return (
      <VerificationPasswordForm
        key={JSON.stringify([uid, token])}
        uid={uid}
        token={token}
      />
    );
  }

  return (
    <VerificationEmailPrompt incompleteLink={uid !== undefined || token !== undefined} />
  );
}

/** Sends the proof and password together without using the active session. */
function VerificationPasswordForm({ uid, token }: { uid: string; token: string }) {
  const router = useRouter();
  const { handleVerifyEmail, loading } = useVerifyEmail();
  const submitting = useRef(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");

  async function verify() {
    if (submitting.current) return;
    setError("");
    if (!password) {
      setPasswordError("Enter your registration password.");
      return;
    }
    setPasswordError("");

    submitting.current = true;
    try {
      const response = await handleVerifyEmail(uid, token, password);
      if (response.success) {
        setPassword("");
        router.replace("/(auth)/email-verified");
        return;
      }

      const fieldError = getFieldError(response, "password");
      setPasswordError(fieldError ?? "");
      if (!fieldError) {
        setError(response.message || "Unable to verify your email. Please try again.");
        handleSystemError(response);
      }
    } catch {
      setError("Unable to verify your email. Please try again.");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <AuthLayout>
      <View className="mb-6 gap-3">
        <AppText weight="bold" className="text-xl text-text-primary">
          Verify your email
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          Enter the password you used to register. If you reset it, enter your updated password.
          If you didn’t create this account, you can close this screen.
        </AppText>
      </View>
      <PasswordInput
        label="REGISTRATION PASSWORD"
        accessibilityLabel="Registration password"
        autoComplete="current-password"
        textContentType="password"
        value={password}
        editable={!loading}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordError("");
        }}
        error={passwordError}
      />
      {error ? <VerificationError message={error} /> : null}
      <Button
        title="Verify email"
        onPress={verify}
        loading={loading}
        disabled={loading}
        rounded="full"
        className="mb-4 mt-5"
      />
      <BottomAuthLink
        text=""
        actionText="Forgot password?"
        onPress={() => router.push("/(auth)/forgot-password")}
      />
      <BottomAuthLink
        text=""
        actionText="Request a new verification email"
        onPress={() => router.replace({
          pathname: "/(auth)/verify-email",
          params: { request: "new" },
        })}
      />
      <BottomAuthLink
        text=""
        actionText="Back to Login"
        onPress={() => router.replace("/(auth)/login")}
      />
    </AuthLayout>
  );
}

/** Shows a persistent error for invalid links or failed requests. */
function VerificationError({ message }: { message: string }) {
  return (
    <AppText
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="mb-4 text-center text-sm text-text-error"
    >
      {message}
    </AppText>
  );
}

/** Supports the check-inbox screen and requesting proof on a different device. */
function VerificationEmailPrompt({ incompleteLink }: { incompleteLink: boolean }) {
  const router = useRouter();
  const { request } = useLocalSearchParams();
  const pendingEmail = useVerificationStore((state) => state.pendingEmail);
  const setPendingEmail = useVerificationStore((state) => state.setPendingEmail);
  const { handleResendVerification, loading } = useResendVerification();
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [error, setError] = useState("");

  async function openEmailApp() {
    try {
      if (await Linking.canOpenURL("mailto:")) {
        await Linking.openURL("mailto:");
        return;
      }
    } catch {
      // The user can open their inbox manually.
    }
    Toast.show({ type: "error", text1: "Unable to open an email app." });
  }

  async function resend() {
    if (loading) return;
    const address = request === "new" ? email.trim() : (pendingEmail || email.trim());
    const validation = validateForgotPasswordForm(address);
    if (validation.email) {
      setError(validation.email);
      return;
    }
    setError("");

    const response = await handleResendVerification(address);
    if (response.success) {
      setPendingEmail(address);
      if (request === "new") router.replace("/(auth)/verify-email");
    }
    if (response.success || response.code === "EMAIL_ALREADY_VERIFIED") {
      Toast.show({
        type: "success",
        text1: response.success ? "Verification email sent." : "Your email is already verified.",
      });
      return;
    }
    if (response.code === "RATE_LIMIT_EXCEEDED") {
      const retryAfter = Number(response.errors?.retry_after ?? response.retry_after);
      setError(getRetryAfterMessage(retryAfter));
      return;
    }
    setError(response.message || "Unable to send verification email.");
    handleSystemError(response);
  }

  const backToLogin = (
    <BottomAuthLink text="" actionText="Back to Login" onPress={() => router.replace("/(auth)/login")} />
  );
  const incompleteMessage = incompleteLink
    ? "This verification link is incomplete. Request a fresh verification email."
    : "";

  if (!pendingEmail || request === "new") {
    return (
      <AuthLayout>
        <AppText weight="bold" className="mb-4 text-xl text-text-primary">
          Request a verification email
        </AppText>
        {incompleteMessage ? <VerificationError message={incompleteMessage} /> : null}
        <FormInput
          label="EMAIL ADDRESS"
          accessibilityLabel="Email address"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          error={error}
        />
        <Button
          title="Send verification email"
          onPress={resend}
          loading={loading}
          disabled={loading}
          rounded="full"
          className="mb-4 mt-5"
        />
        {backToLogin}
      </AuthLayout>
    );
  }

  return (
    <EmailConfirmationLayout
      title="Verify your email"
      description="We've sent a verification email to"
      email={pendingEmail}
      openEmailApp={openEmailApp}
      resendTitle="Resend email"
      onResend={resend}
      resendLoading={loading}
    >
      {error || incompleteMessage ? <VerificationError message={error || incompleteMessage} /> : null}
      {backToLogin}
    </EmailConfirmationLayout>
  );
}
