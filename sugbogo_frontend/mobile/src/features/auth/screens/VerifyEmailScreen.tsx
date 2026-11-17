import { MaterialIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { resolvePostLoginRoute } from "@/features/app-mode/utils/resolveAppModeRoute";
import AuthLayout from "@/features/auth/components/AuthLayout";
import BottomAuthLink from "@/features/auth/components/BottomAuthLink";
import EmailConfirmationLayout from "@/features/auth/components/EmailConfirmationLayout";
import VerificationRecoverySheet from "@/features/auth/components/VerificationRecoverySheet";
import { useResendVerification } from "@/features/auth/hooks/useResendVerification";
import { useVerifyEmail } from "@/features/auth/hooks/useVerifyEmail";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import { establishSession } from "@/features/auth/utils/authSession";
import { validateForgotPasswordForm } from "@/features/auth/utils/forgotPasswordValidator";
import { parseVerificationSession } from "@/features/auth/utils/verificationSession";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  isAuthSessionGenerationCurrent,
  isOfflineTransportSession,
  isStaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import PasswordInput from "@/shared/components/form/PasswordInput";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import { getRetryAfterMessage } from "@/shared/utils/retryAfterMessage";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

const MASCOT_PASSWORD_CONFIRMATION = require("@/shared/assets/mascot/mascot-reset-password.webp");

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
function VerificationPasswordForm({
  uid,
  token,
}: {
  uid: string;
  token: string;
}) {
  const router = useRouter();
  const { handleVerifyEmail, loading } = useVerifyEmail();
  const { handleResendVerification, loading: resending } = useResendVerification();
  const pendingEmail = useVerificationStore((state) => state.pendingEmail);
  const setPendingEmail = useVerificationStore((state) => state.setPendingEmail);
  const clearPendingEmail = useVerificationStore((state) => state.clearPendingEmail);
  const submitting = useRef(false);
  const focusGeneration = useRef(0);
  const recoverySheetRef = useRef<BottomSheetModal | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [invalidLink, setInvalidLink] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState(pendingEmail ?? "");
  const [emailError, setEmailError] = useState("");
  const [resendError, setResendError] = useState("");
  const [establishingSession, setEstablishingSession] = useState(false);
  const verifying = loading || establishingSession;
  const busy = verifying || resending;

  useFocusEffect(
    useCallback(() => {
      return () => {
        focusGeneration.current += 1;
      };
    }, []),
  );

  function openRecoverySheet(address = pendingEmail ?? "") {
    setEmail(address);
    setEmailError("");
    setResendError("");
    setShowEmailInput(true);
    if (!showEmailInput) {
      presentBottomSheet(recoverySheetRef);
    }
  }

  async function requestNewLink() {
    if (submitting.current) {
      return;
    }
    if (!pendingEmail && !showEmailInput) {
      openRecoverySheet();
      return;
    }

    const address = showEmailInput
      ? email.trim()
      : (pendingEmail ?? "");
    const validation = validateForgotPasswordForm(address);
    if (validation.email) {
      openRecoverySheet(address);
      setEmailError(validation.email);
      return;
    }

    setEmailError("");
    setResendError("");
    submitting.current = true;
    try {
      const response = await handleResendVerification(address);
      if (response.success) {
        setPendingEmail(address);
        setPassword("");
        Toast.show({ type: "success", text1: "Verification email sent." });
        recoverySheetRef.current?.dismiss();
        router.replace("/(auth)/verify-email");
        return;
      }
      if (response.code === "EMAIL_ALREADY_VERIFIED") {
        setPassword("");
        recoverySheetRef.current?.dismiss();
        router.replace("/(auth)/email-verified");
        return;
      }
      if (response.code === "RATE_LIMIT_EXCEEDED") {
        const retryAfter = Number(response.errors?.retry_after ?? response.retry_after);
        setResendError(getRetryAfterMessage(retryAfter));
        return;
      }
      const fieldError = getFieldError(response, "email");
      if (
        fieldError ||
        response.code === "USER_NOT_FOUND"
      ) {
        openRecoverySheet(address);
        setEmailError(fieldError || response.message || "Check your email address.");
        return;
      }
      setResendError(response.message || "Unable to send verification email. Please try again.");
      handleSystemError(response);
    } catch {
      setResendError("Unable to send verification email. Please try again.");
    } finally {
      submitting.current = false;
    }
  }

  /** Confirms verification and installs a session only for the current request. */
  async function verify() {
    if (submitting.current) return;
    setError("");
    if (!password) {
      setPasswordError("Enter your current password.");
      return;
    }
    setPasswordError("");

    const generation = getAuthSessionGeneration();
    const focus = focusGeneration.current;
    const isCurrentForm = () => focusGeneration.current === focus;
    const canInstall = () => {
      const { isAuthenticated, isLoading, isSigningIn } = useAuthStore.getState();
      return isCurrentForm() && !isAuthenticated && !isLoading && !isSigningIn;
    };
    const autoLogin =
      canInstall() &&
      !isAuthSessionCurrent(generation) &&
      !isOfflineTransportSession(generation);

    submitting.current = true;
    try {
      const response = await handleVerifyEmail(uid, token, password, autoLogin);
      if (!isCurrentForm() || !isAuthSessionGenerationCurrent(generation)) {
        return;
      }

      if (response.success === true) {
        setPassword("");
        const session = autoLogin ? parseVerificationSession(response.data) : null;
        if (session) {
          setEstablishingSession(true);

          let installed: number;
          try {
            installed = await establishSession(session, canInstall);
          } catch (error) {
            if (canInstall() && !isStaleAuthSessionError(error)) {
              router.replace("/(auth)/email-verified");
            }
            return;
          }

          if (!isCurrentForm() || !isAuthSessionCurrent(installed)) {
            return;
          }
          clearPendingEmail();
          router.replace(
            resolvePostLoginRoute(
              session.user,
              useAppModeStore.getState().activeMode,
            ),
          );
          return;
        }

        const { isAuthenticated, isLoading, isSigningIn } = useAuthStore.getState();
        if (!isLoading && !isSigningIn) {
          router.replace(isAuthenticated ? "/" : "/(auth)/email-verified");
        }
        return;
      }

      if (response.code === "INVALID_VERIFICATION_LINK") {
        setPassword("");
        setPasswordError("");
        setInvalidLink(true);
        return;
      }

      if (response.code === "ACCOUNT_LOCKED" || response.code === "RATE_LIMIT_EXCEEDED") {
        setPassword("");
        const retryAfter = Number(response.errors?.retry_after ?? response.retry_after);
        setError(`${response.message} ${getRetryAfterMessage(retryAfter)}`);
        return;
      }

      if (response.code === "NETWORK_ERROR" || response.code === "REQUEST_TIMEOUT") {
        setError("Try again, or go back to log in if your email was already verified.");
        return;
      }

      const fieldError = getFieldError(response, "password");
      setPasswordError(fieldError ?? "");
      if (!fieldError) {
        setError(response.message || "Unable to verify your email. Please try again.");
        handleSystemError(response);
      }
    } catch {
      if (isCurrentForm() && isAuthSessionGenerationCurrent(generation)) {
        setError("Try again, or go back to log in if your email was already verified.");
      }
    } finally {
      setEstablishingSession(false);
      submitting.current = false;
    }
  }

  return (
    <AuthLayout paddingTop={24}>
      {/* Password confirmation introduction */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="mb-6 items-center justify-center"
      >
        <Image
          source={MASCOT_PASSWORD_CONFIRMATION}
          style={{
            width: 140,
            height: 140,
          }}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <View className="mb-7">
        <AppText
          weight="bold"
          className="text-center text-xl text-text-primary"
          accessibilityRole="header"
        >
          {invalidLink
            ? "This verification link is unavailable"
            : "Confirm your password"}
        </AppText>
        <AppText
          accessibilityLiveRegion="polite"
          className="mt-2 text-center text-sm leading-5 text-text-secondary"
        >
          {invalidLink
            ? "Request a new link, or log in if your email is already verified."
            : "Enter your current SugboGo password to finish verifying your email."}
        </AppText>
      </View>

      {/* Password confirmation or link recovery */}
      {!invalidLink ? (
        <>
          <PasswordInput
            label="PASSWORD"
            accessibilityLabel="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            editable={!busy}
            onChangeText={(value) => {
              setPassword(value);
              setPasswordError("");
            }}
            error={passwordError}
            rightElement={
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Forgot password?"
                accessibilityState={{ disabled: busy }}
                hitSlop={12}
                className="cursor-pointer py-2 active:opacity-60"
              >
                <AppText
                  weight="semibold"
                  className="text-xs tracking-[0.3px] text-brand"
                >
                  Forgot?
                </AppText>
              </Pressable>
            }
          />
          {error ? <VerificationError message={error} /> : null}
          <Button
            title="Verify email"
            onPress={verify}
            loading={verifying}
            disabled={busy}
            textWeight="bold"
            rounded="full"
            className="mb-3 mt-5"
          />
        </>
      ) : null}

      {/* Resend action */}
      {resendError && !showEmailInput ? (
        <VerificationError message={resendError} />
      ) : null}
      <Button
        title="Resend email"
        onPress={requestNewLink}
        loading={resending}
        disabled={busy}
        variant={invalidLink ? "primary" : "outline"}
        rounded="full"
        textWeight="semibold"
        className="mb-4"
      />

      {/* Exit navigation */}
      <Pressable
        onPress={() => router.replace("/(auth)/login")}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Back to log in"
        accessibilityState={{ disabled: busy }}
        className="mt-2 min-h-12 cursor-pointer flex-row items-center justify-center py-3 active:opacity-60"
      >
        <MaterialIcons
          name="arrow-back"
          size={20}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
        <AppText weight="semibold" className="ml-1 text-sm text-text-secondary">
          Back to log in
        </AppText>
      </Pressable>

      {/* Email-entry recovery stays outside the page composition */}
      <VerificationRecoverySheet
        sheetRef={recoverySheetRef}
        email={email}
        emailError={emailError}
        error={resendError}
        loading={busy}
        onChangeEmail={(value) => {
          setEmail(value);
          setEmailError("");
        }}
        onSubmit={requestNewLink}
        onDismiss={() => setShowEmailInput(false)}
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
      <AuthLayout paddingTop={24}>
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
      paddingTop={24}
      title="Check your email"
      description="We've sent a verification link to"
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
