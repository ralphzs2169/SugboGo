import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useChangePassword } from "@/features/auth/hooks/useChangePassword";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  type ChangePasswordErrors,
  validateChangePasswordForm,
} from "@/features/auth/utils/changePasswordValidator";
import {
  getAuthSessionGeneration,
  isAuthSessionGenerationCurrent,
  isStaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import PasswordInput from "@/shared/components/form/PasswordInput";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";

/** Changes an existing password or directs passwordless accounts to email recovery. */
export default function ChangePasswordScreen() {
  const user = useAuthStore((state) => state.user);
  const mutation = useChangePassword();
  const { logout } = useLogout();
  const submitting = useRef(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [formError, setFormError] = useState("");
  const isPending = mutation.isPending || isRecovering;
  const needsPasswordSetup = user?.has_usable_password === false;
  const { showConfirm, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    !!(currentPassword || newPassword || confirmPassword),
  );

  /** Clears stale feedback as the user corrects an individual field. */
  function clearError(field: keyof ChangePasswordErrors) {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError("");
  }

  /** Validates and submits exactly one password-change request at a time. */
  async function handleSave() {
    if (submitting.current || isPending) return;
    const validation = validateChangePasswordForm(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    setErrors(validation);
    setFormError("");
    if (Object.keys(validation).length) return;

    submitting.current = true;
    try {
      await mutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
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
        const fieldErrors = {
          currentPassword: getFieldError(response, "current_password"),
          newPassword: getFieldError(response, "new_password"),
          confirmPassword: getFieldError(response, "confirm_password"),
        };
        setErrors(fieldErrors);
        setFormError(
          Object.values(fieldErrors).some(Boolean)
            ? "Please check the highlighted fields."
            : response.message,
        );
        handleSystemError(response);
      } else {
        setFormError("Unable to change your password. Please try again.");
      }
    } finally {
      submitting.current = false;
    }
  }

  /** Leaves the local session before opening the existing email recovery flow. */
  async function handleEmailRecovery() {
    if (submitting.current || isPending || !user) return;
    submitting.current = true;
    setIsRecovering(true);
    const email = user.email;
    const cleanup = logout();
    const generation = getAuthSessionGeneration();
    await cleanup;
    if (isAuthSessionGenerationCurrent(generation)) {
      router.replace({
        pathname: "/(auth)/forgot-password",
        params: { email },
      });
    }
    submitting.current = false;
    setIsRecovering(false);
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
          {/* Password management guidance */}
          <View className="mb-6">
            <AppText weight="bold" className="text-xl text-text-primary">
              {needsPasswordSetup
                ? "Set up a password"
                : "Change your password"}
            </AppText>
            <AppText className="mt-2 text-sm leading-5 text-text-secondary">
              {needsPasswordSetup
                ? "You currently sign in with a linked account. To create a password, sign out and verify your email using password recovery."
                : "Choose a password you don't use elsewhere. After saving, you'll be signed out on all devices and asked to sign in again."}
            </AppText>
          </View>

          {needsPasswordSetup ? (
            <Button
              title="Continue to email recovery"
              onPress={handleEmailRecovery}
              loading={isRecovering}
              rounded="full"
            />
          ) : (
            <>
              {/* Persistent request and validation feedback */}
              {formError ? (
                <AppText
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="mb-5 text-sm text-text-error"
                >
                  {formError}
                </AppText>
              ) : null}

              {/* Current-password proof and replacement */}
              <PasswordInput
                label="CURRENT PASSWORD"
                accessibilityLabel="Current password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  clearError("currentPassword");
                }}
                error={errors.currentPassword}
                editable={!isPending}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
              />
              <AppText className="mb-4 text-sm leading-5 text-text-secondary">
                Use at least 8 characters. Avoid common passwords, only numbers,
                or your personal information.
              </AppText>
              <PasswordInput
                label="NEW PASSWORD"
                accessibilityLabel="New password"
                placeholder="Enter your new password"
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  clearError("newPassword");
                }}
                error={errors.newPassword}
                editable={!isPending}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <PasswordInput
                label="CONFIRM NEW PASSWORD"
                accessibilityLabel="Confirm new password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  clearError("confirmPassword");
                }}
                error={errors.confirmPassword}
                editable={!isPending}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />

              {/* Submit and session-expiry disclosure */}
              <Button
                title="Save password"
                onPress={handleSave}
                loading={mutation.isPending}
                disabled={isPending}
                rounded="full"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Protect unsaved passwords during back navigation */}
      <ConfirmModal
        visible={showConfirm}
        title="Discard changes?"
        message="Your password changes haven't been saved."
        confirmText="Discard"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        destructive
        isLoading={isPending}
      />
    </SafeAreaView>
  );
}
