import { type Href, router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useEmailChange } from "@/features/auth/hooks/useEmailChange";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  validateEmailChange,
  type EmailChangeErrors,
} from "@/features/auth/utils/emailChangeValidator";
import { isStaleAuthSessionError } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import FormInput from "@/shared/components/form/FormInput";
import PasswordInput from "@/shared/components/form/PasswordInput";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";

/** Requests verified email changes while keeping current and pending addresses distinct. */
export default function ChangeEmailScreen() {
  const user = useAuthStore((state) => state.user);
  const { status, requestChange, cancelChange } = useEmailChange();
  const submitting = useRef(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<EmailChangeErrors>({});
  const [formError, setFormError] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const { showConfirm, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    !!(newEmail || password),
  );
  const isPending = requestChange.isPending || cancelChange.isPending;
  useQueryErrorNotification({
    error: status.error,
    toastId: "email-change-status",
    title: "Unable to load email settings",
    fallbackMessage: "Please try again.",
  });

  /** Keeps backend field failures and transport failures visible without discarding input. */
  function showError(error: unknown) {
    if (isStaleAuthSessionError(error)) return;
    const response = error as ApiError;
    if (response?.success === false) {
      setErrors({
        newEmail: getFieldError(response, "new_email"),
        currentPassword: getFieldError(response, "current_password"),
      });
      setFormError(response.message);
      handleSystemError(response);
    } else {
      setFormError("Unable to update your email request. Please try again.");
    }
  }

  /** Sends exactly one password-confirmed request for new-address verification. */
  async function handleRequest() {
    if (submitting.current || isPending || status.isError) return;
    const validation = validateEmailChange(
      newEmail,
      status.data?.current_email ?? user?.email ?? "",
      password,
    );
    setErrors(validation);
    setFormError("");
    if (Object.keys(validation).length) return;
    submitting.current = true;
    try {
      await requestChange.mutateAsync({
        new_email: newEmail.trim(),
        current_password: password,
      });
      setNewEmail("");
      setPassword("");
      Toast.show({
        type: "success",
        text1: "Verification email sent",
        text2: "Your current email stays unchanged until you confirm.",
      });
    } catch (error) {
      showError(error);
    } finally {
      submitting.current = false;
    }
  }

  /** Cancels the pending link after explicit confirmation. */
  async function handleCancel() {
    if (submitting.current || isPending) return;
    submitting.current = true;
    setFormError("");
    try {
      await cancelChange.mutateAsync();
      setShowCancel(false);
    } catch (error) {
      showError(error);
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
          {/* Existing sign-in identity and verification policy */}
          <AppText weight="bold" className="text-xl text-text-primary">
            Change your email
          </AppText>
          <AppText className="mt-2 mb-6 text-sm leading-5 text-text-secondary">
            Your current email stays active until you verify the new address.
            Confirming the change signs you out on all devices. Your linked
            sign-in accounts stay connected.
          </AppText>
          {status.isPending ? (
            <View className="gap-4">
              <Skeleton className="h-5 w-48 rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </View>
          ) : !status.data && status.isError ? (
            <ErrorState
              size="section"
              title="Unable to load email settings"
              description="Check your connection and try again."
              primaryActionTitle="Retry"
              onPrimaryAction={() => {
                void status.refetch();
              }}
            />
          ) : (
            <>
              {status.isError ? (
                <ErrorState
                  size="section"
                  title="Email settings could not refresh"
                  description="Retry before sending another request."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => {
                    void status.refetch();
                  }}
                />
              ) : null}
              <AppText
                weight="semibold"
                className="text-sm text-text-secondary"
              >
                Current email
              </AppText>
              <AppText className="mt-1 mb-6 text-base text-text-primary">
                {status.data?.current_email ?? user?.email}
              </AppText>
              {/* Pending changes survive navigation and app restarts */}
              {status.data?.pending ? (
                <View className="mb-6 gap-3">
                  <AppText
                    weight="semibold"
                    className="text-base text-text-primary"
                  >
                    Awaiting verification
                  </AppText>
                  <AppText className="text-sm text-text-primary">
                    {status.data.pending.new_email}
                  </AppText>
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Open the link in the new inbox and enter your current
                    password to confirm. It expires{" "}
                    {new Date(status.data.pending.expires_at).toLocaleString()}.
                    To resend or replace it, enter the destination and password
                    below; only the latest link will work.
                  </AppText>
                  <Button
                    title="Cancel pending change"
                    variant="outline"
                    rounded="full"
                    disabled={isPending}
                    onPress={() => {
                      setFormError("");
                      setShowCancel(true);
                    }}
                  />
                </View>
              ) : null}
              {/* Passwordless accounts reuse the existing password setup flow */}
              {user?.has_usable_password === false ? (
                <>
                  <AppText className="mb-5 text-sm leading-5 text-text-secondary">
                    Set up a password through email recovery, sign in again,
                    then return here to change your email.
                  </AppText>
                  <Button
                    title="Set up a password"
                    rounded="full"
                    onPress={() =>
                      router.push("/profile/change-password" as Href)
                    }
                  />
                </>
              ) : (
                <>
                  {!showCancel && formError ? (
                    <AppText
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      className="mb-4 text-sm text-text-error"
                    >
                      {formError}
                    </AppText>
                  ) : null}
                  <FormInput
                    label="NEW EMAIL"
                    accessibilityLabel="New email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    value={newEmail}
                    maxLength={100}
                    editable={!isPending}
                    error={errors.newEmail}
                    onChangeText={(value) => {
                      setNewEmail(value);
                      setErrors((previous) => ({
                        ...previous,
                        newEmail: undefined,
                      }));
                      setFormError("");
                    }}
                  />
                  <PasswordInput
                    label="CURRENT PASSWORD"
                    accessibilityLabel="Current password"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    value={password}
                    editable={!isPending}
                    error={errors.currentPassword}
                    onChangeText={(value) => {
                      setPassword(value);
                      setErrors((previous) => ({
                        ...previous,
                        currentPassword: undefined,
                      }));
                      setFormError("");
                    }}
                  />
                  <Button
                    title="Send verification email"
                    onPress={handleRequest}
                    loading={requestChange.isPending}
                    disabled={isPending || status.isError}
                    rounded="full"
                  />
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Link cancellation does not change the sign-in email */}
      <ConfirmModal
        visible={showCancel}
        title="Cancel pending email change?"
        message={
          <View className="gap-3">
            <AppText className="text-sm text-text-secondary">
              The verification link will stop working. Your current email stays
              unchanged.
            </AppText>
            {formError ? (
              <AppText
                accessibilityRole="alert"
                className="text-sm text-text-error"
              >
                {formError}
              </AppText>
            ) : null}
          </View>
        }
        confirmText="Cancel change"
        cancelText="Keep change"
        onConfirm={handleCancel}
        onCancel={() => {
          if (!submitting.current && !isPending) setShowCancel(false);
        }}
        destructive
        isLoading={cancelChange.isPending}
      />
      <ConfirmModal
        visible={showConfirm}
        title="Discard changes?"
        message="Your unsent email change will be discarded. An existing pending request will stay active."
        confirmText="Discard"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        destructive
        isLoading={isPending}
      />
    </SafeAreaView>
  );
}
