import { type Href, router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDeactivateAccount } from "@/features/auth/hooks/useDeactivateAccount";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isStaleAuthSessionError } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import PasswordInput from "@/shared/components/form/PasswordInput";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";

/** Explains retained data and requires password proof plus final deactivation consent. */
export default function DeactivateAccountScreen() {
  const user = useAuthStore((state) => state.user);
  const mutation = useDeactivateAccount();
  const submitting = useRef(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const needsPasswordSetup = user?.has_usable_password === false;
  const { showConfirm, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(!!password);

  /** Opens confirmation only after the current-password field is complete. */
  function requestConfirmation() {
    if (mutation.isPending || submitting.current) return;
    setFormError("");
    setPasswordError(password ? "" : "Enter your current password.");
    if (password) setShowConfirmation(true);
  }

  /** Sends one explicitly confirmed deactivation request and preserves retryable errors. */
  async function handleDeactivate() {
    if (submitting.current || mutation.isPending || !showConfirmation) return;
    submitting.current = true;
    setFormError("");
    try {
      await mutation.mutateAsync({
        current_password: password,
        confirm_deactivation: true,
      });
    } catch (error) {
      if (isStaleAuthSessionError(error)) return;
      if (
        error &&
        typeof error === "object" &&
        "success" in error &&
        error.success === false
      ) {
        const response = error as ApiError;
        const fieldError = getFieldError(response, "current_password");
        setPasswordError(fieldError ?? "");
        setFormError(fieldError || response.message);
        handleSystemError(response);
      } else {
        setFormError("Unable to deactivate your account. Please try again.");
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-surface"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="px-6 py-6"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Consequences, retained content, and manual recovery */}
          <View className="mb-6 gap-3">
            <AppText weight="bold" className="text-xl text-text-primary">
              Take a break from SugboGo
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Deactivating signs you out on all devices and blocks sign-in.
              Contact support to request reactivation; signing in or resetting
              your password will not reactivate your account.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              Your profile, reviews, vouches, and saved content stay stored.
              Existing public contributions remain visible. This does not delete
              your data.
            </AppText>
            <AppText className="text-sm leading-5 text-text-secondary">
              If you own a business, its listing and merchant application stay
              unchanged. Deactivation does not close or hide the listing, and
              you cannot manage it while your account is inactive.
            </AppText>
          </View>

          {/* Password ownership proof or the existing setup flow */}
          {needsPasswordSetup ? (
            <>
              <AppText className="mb-5 text-sm leading-5 text-text-secondary">
                You sign in with a linked account. Set up a password through
                email recovery, sign in again, then return here to deactivate.
              </AppText>
              <Button
                title="Set up a password"
                rounded="full"
                onPress={() => router.push("/profile/change-password" as Href)}
              />
            </>
          ) : (
            <>
              {!showConfirmation && formError ? (
                <AppText
                  accessibilityRole="alert"
                  className="mb-4 text-sm text-text-error"
                >
                  {formError}
                </AppText>
              ) : null}
              <PasswordInput
                label="CURRENT PASSWORD"
                accessibilityLabel="Current password"
                placeholder="Enter your current password"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setPasswordError("");
                  setFormError("");
                }}
                error={passwordError}
                editable={!mutation.isPending}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
              />
              <Button
                title="Deactivate account"
                variant="danger"
                rounded="full"
                onPress={requestConfirmation}
                disabled={mutation.isPending}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Explicit consent remains visible while the request completes */}
      <ConfirmModal
        visible={showConfirmation}
        title="Deactivate your account?"
        message={
          <View className="gap-3">
            <AppText className="text-sm leading-5 text-text-secondary">
              You will lose account access on every device. Your data and any
              business listing stay stored. Contact support to request
              reactivation.
            </AppText>
            {formError ? (
              <AppText
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="text-sm text-text-error"
              >
                {formError}
              </AppText>
            ) : null}
          </View>
        }
        confirmText="Deactivate"
        cancelText={formError ? "Go back" : "Cancel"}
        onConfirm={handleDeactivate}
        onCancel={() => {
          if (!submitting.current && !mutation.isPending)
            setShowConfirmation(false);
        }}
        destructive
        isLoading={mutation.isPending}
        loadingText="Deactivating your account..."
      />
      <ConfirmModal
        visible={showConfirm}
        title="Discard changes?"
        message="Your account has not been deactivated."
        confirmText="Discard"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        destructive
        isLoading={mutation.isPending}
      />
    </SafeAreaView>
  );
}
