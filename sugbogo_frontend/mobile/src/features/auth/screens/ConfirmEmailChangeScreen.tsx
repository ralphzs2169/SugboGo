import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import PasswordInput from "@/shared/components/form/PasswordInput";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";
import AuthLayout from "../components/AuthLayout";
import { useConfirmEmailChange } from "../hooks/useEmailChange";
import { useAuthStore } from "../store/auth.store";

/** Confirms a deep-linked email change only after explicit password entry and submission. */
export default function ConfirmEmailChangeScreen() {
  const params = useLocalSearchParams<{
    request_id?: string | string[];
    token?: string | string[];
  }>();
  const requestId =
    typeof params.request_id === "string" ? params.request_id : "";
  const token = typeof params.token === "string" ? params.token : "";
  const validLink =
    /^[0-9a-f-]{36}$/i.test(requestId) && !!token && token.length <= 128;
  const mutation = useConfirmEmailChange();
  const submitting = useRef(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [error, setError] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");

  /** Confirms once without automatically consuming links during previews or app launches. */
  async function handleConfirm() {
    if (!validLink || submitting.current || mutation.isPending) return;
    setPasswordError(password ? "" : "Enter your current password.");
    if (!password) return;
    submitting.current = true;
    setError("");
    try {
      const result = await mutation.mutateAsync({
        request_id: requestId,
        token,
        current_password: password,
      });
      setPassword("");
      setConfirmedEmail(result.email);
    } catch (failure) {
      const response = failure as ApiError;
      if (response?.success === false) {
        setPasswordError(getFieldError(response, "current_password") ?? "");
        setError(
          getFieldError(response, "token") ||
            getFieldError(response, "new_email") ||
            response.message,
        );
        handleSystemError(response);
      } else setError("Unable to confirm this email change. Please try again.");
    } finally {
      submitting.current = false;
    }
  }

  /** Returns to whichever local account is still active after confirmation. */
  function handleContinue() {
    router.replace(useAuthStore.getState().user ? "/" : "/(auth)/login");
  }

  return (
    <AuthLayout>
      {/* Link confirmation is an explicit action, including for signed-out users */}
      <View className="mb-6 gap-3">
        <AppText weight="bold" className="text-xl text-text-primary">
          {confirmedEmail ? "Email changed" : "Confirm your new email"}
        </AppText>
        <AppText className="text-sm leading-5 text-text-secondary">
          {confirmedEmail
            ? `Your sign-in email is now ${confirmedEmail}. Existing sessions were revoked. Use your new address next time you sign in.`
            : "Enter the current password for the account that requested this change. Your email changes only when you confirm, and existing sessions will be revoked."}
        </AppText>
      </View>
      {confirmedEmail ? (
        <Button title="Continue" rounded="full" onPress={handleContinue} />
      ) : !validLink ? (
        <>
          <AppText
            accessibilityRole="alert"
            className="mb-5 text-sm text-text-error"
          >
            This email-change link is incomplete. Open the latest link from your
            email, or request another from Account Settings.
          </AppText>
          <Button title="Continue" rounded="full" onPress={handleContinue} />
        </>
      ) : (
        <>
          {/* Password proof and recoverable confirmation feedback */}
          {error ? (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mb-4 text-sm text-text-error"
            >
              {error}
            </AppText>
          ) : null}
          <PasswordInput
            label="CURRENT PASSWORD"
            accessibilityLabel="Current password"
            value={password}
            error={passwordError}
            editable={!mutation.isPending}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            onChangeText={(value) => {
              setPassword(value);
              setPasswordError("");
              setError("");
            }}
          />
          <Button
            title="Confirm email change"
            rounded="full"
            onPress={handleConfirm}
            loading={mutation.isPending}
          />
          <Button
            title="Go back"
            variant="outline"
            rounded="full"
            className="mt-3"
            onPress={handleContinue}
            disabled={mutation.isPending}
          />
        </>
      )}
    </AuthLayout>
  );
}
