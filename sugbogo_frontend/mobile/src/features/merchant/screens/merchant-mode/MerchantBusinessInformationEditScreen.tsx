import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import MerchantRefreshRecovery from "../../components/MerchantRefreshRecovery";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormInput from "@/shared/components/form/FormInput";
import FormTextArea from "@/shared/components/form/FormTextArea";
import useMerchantEditorExit from "../../hooks/useMerchantEditorExit";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import MerchantBusinessEditSkeleton from "../../components/business-profile/MerchantBusinessEditSkeleton";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateMerchantBusinessInformation from "../../hooks/business-profile/useUpdateMerchantBusinessInformation";
import { merchantBusinessInformationSchema } from "../../validation/merchantBusinessInformation.schema";

type BusinessInformationForm = z.infer<
  typeof merchantBusinessInformationSchema
>;

/**
 * Allows merchants to edit their business description, access directions and contact details.
 *
 * Displays full-width guidance for direct updates, initializes the form
 * with existing business information, validates changes, and handles
 * server errors. Unsubmitted edits require discard confirmation, and editing
 * is unavailable for suspended businesses.
 */
export default function MerchantBusinessInformationEditScreen() {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();
  useApiErrorNotification({
    error,
    toastId: "merchant-business-information-profile-error",
    title: "Unable to load business",
    fallbackMessage: "Please try again.",
  });
  const initializedBusinessId = useRef<number | null>(business?.id ?? null);
  const [readyBusinessId, setReadyBusinessId] = useState<number | null>(
    business?.id ?? null,
  );

  const { updateInformation, isSaving: mutationPending } =
    useUpdateMerchantBusinessInformation(business?.id);

  const isSaving = mutationPending || submitting;

  const form = useForm<BusinessInformationForm>({
    resolver: zodResolver(merchantBusinessInformationSchema),
    disabled: isSaving,
    defaultValues: {
      businessDescription: business?.description ?? "",
      accessDirections: business?.access_directions ?? "",
      contactNumber: business?.contact_number ?? "",
      businessEmail: business?.business_email ?? "",
      website: business?.website ?? "",
    },
  });

  const { reset } = form;
  const { isDirty: hasChanges, dirtyFields } = form.formState;

  useEffect(() => {
    if (
      !business ||
      (initializedBusinessId.current === business.id && hasChanges)
    ) {
      return;
    }

    initializedBusinessId.current = business.id;

    reset({
      businessDescription: business.description ?? "",
      accessDirections: business.access_directions ?? "",
      contactNumber: business.contact_number,
      businessEmail: business.business_email ?? "",
      website: business.website ?? "",
    });
    setReadyBusinessId(business.id);
  }, [business, hasChanges, reset]);

  const exit = useMerchantEditorExit(
    hasChanges,
    isSaving || form.formState.isSubmitting,
    () => savingRef.current,
  );

  async function submitValues(values: BusinessInformationForm) {
    if (savingRef.current || !form.formState.isDirty) {
      return;
    }

    savingRef.current = true;
    setSubmitting(true);

    let finishing = false;
    try {
      // PATCH only edited fields so a refetch cannot make untouched values stale writes.
      await updateInformation({
        ...(dirtyFields.businessDescription && {
          description: values.businessDescription,
        }),
        ...(dirtyFields.accessDirections && {
          access_directions: values.accessDirections,
        }),
        ...(dirtyFields.contactNumber && {
          contact_number: values.contactNumber,
        }),
        ...(dirtyFields.businessEmail && {
          business_email: values.businessEmail,
        }),
        ...(dirtyFields.website && { website: values.website }),
      });

      Toast.show({
        type: "success",
        text1: "Business information updated",
      });

      finishing = exit.finish();
    } catch (error) {
      const response = error as ApiError;

      if (response.code === "VALIDATION_ERROR") {
        const fields = {
          description: "businessDescription",
          access_directions: "accessDirections",
          contact_number: "contactNumber",
          business_email: "businessEmail",
          website: "website",
        } as const;

        let hasFieldError = false;

        for (const [apiField, formField] of Object.entries(fields)) {
          const message = getFieldError(response, apiField);

          if (message) {
            hasFieldError = true;

            form.setError(formField as keyof BusinessInformationForm, {
              type: "server",
              message,
            });
          }
        }

        if (!hasFieldError) {
          Toast.show({
            type: "error",
            text1: "Unable to save business information",
            text2: response.message,
          });
        }

        return;
      }

      if (!handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to save business information",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      if (!finishing) {
        savingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  const discardDialog = (
    <ConfirmModal
      visible={exit.showDiscard}
      title="Discard business information changes?"
      message="Your unsaved business information changes will be lost."
      confirmText="Discard"
      destructive
      cancelText="Keep Editing"
      onCancel={exit.keepEditing}
      onConfirm={exit.discard}
    />
  );

  // Initial business loading state
  if (
    (isLoading && !business) ||
    (business && readyBusinessId !== business.id)
  ) {
    return (
      <>
        <MerchantBusinessEditSkeleton variant="information" />
        {discardDialog}
      </>
    );
  }

  // Business profile unavailable
  if (!business) {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          title="Unable to load business information"
          description={
            error ? "Please try again." : "Business information is unavailable."
          }
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
        {discardDialog}
      </View>
    );
  }

  // Suspended businesses cannot edit information
  if (business.status === "suspended") {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          title="Editing unavailable"
          description="Business information cannot be edited while your business is suspended."
          primaryActionTitle="Go Back"
          onPrimaryAction={() => router.back()}
        />
        {discardDialog}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-surface"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <MerchantRefreshRecovery error={error} refetch={refetch} />
        {/* Full-width business information notice */}
        <View className="bg-info px-4 py-4">
          <View className="flex-row items-start">
            <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={theme.extends.colors.text.info}
              />
            </View>

            <View className="ml-3 flex-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                About business information
              </AppText>

              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                You can update your business description, access directions and
                contact details without administrator approval. Changes will
                appear on your business listing after saving.
              </AppText>
            </View>
          </View>
        </View>

        {/* Editable business information fields */}
        <View className="px-5 pt-5">
          {/* Business description */}
          <Controller
            control={form.control}
            name="businessDescription"
            render={({ field, fieldState }) => (
              <FormTextArea
                label="Description"
                required
                minLength={10}
                showCharacterCount
                maxLength={500}
                placeholder="Tell explorers about your business..."
                editable={!isSaving && !form.formState.isSubmitting}
                accessibilityState={{
                  disabled: isSaving || form.formState.isSubmitting,
                }}
                value={field.value}
                onChangeText={(value) => {
                  if (!savingRef.current) field.onChange(value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          {/* Optional business access notes */}
          <Controller
            control={form.control}
            name="accessDirections"
            render={({ field, fieldState }) => (
              <FormTextArea
                label="Access notes (optional)"
                accessibilityLabel="Access notes"
                maxLength={1000}
                helperText="Help visitors find your entrance or understand the last part of their visit. Shown to Explorers as merchant-provided Access notes."
                placeholder="e.g. Use the side entrance beside the bakery. Our shop is upstairs on the second floor."
                editable={!isSaving && !form.formState.isSubmitting}
                accessibilityState={{
                  disabled: isSaving || form.formState.isSubmitting,
                }}
                value={field.value}
                onChangeText={(value) => {
                  if (!savingRef.current) field.onChange(value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          {/* Business contact number */}
          <Controller
            control={form.control}
            name="contactNumber"
            render={({ field, fieldState }) => (
              <FormInput
                label="Contact number"
                required
                keyboardType="phone-pad"
                placeholder="0912 345 6789"
                editable={!isSaving && !form.formState.isSubmitting}
                accessibilityState={{
                  disabled: isSaving || form.formState.isSubmitting,
                }}
                value={field.value}
                onChangeText={(value) => {
                  if (!savingRef.current) field.onChange(value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          {/* Business email */}
          <Controller
            control={form.control}
            name="businessEmail"
            render={({ field, fieldState }) => (
              <FormInput
                label="Business email"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="business@example.com"
                editable={!isSaving && !form.formState.isSubmitting}
                accessibilityState={{
                  disabled: isSaving || form.formState.isSubmitting,
                }}
                value={field.value}
                onChangeText={(value) => {
                  if (!savingRef.current) field.onChange(value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />

          {/* Business website */}
          <Controller
            control={form.control}
            name="website"
            render={({ field, fieldState }) => (
              <FormInput
                label="Website"
                keyboardType="url"
                autoCapitalize="none"
                placeholder="https://..."
                editable={!isSaving && !form.formState.isSubmitting}
                accessibilityState={{
                  disabled: isSaving || form.formState.isSubmitting,
                }}
                value={field.value}
                onChangeText={(value) => {
                  if (!savingRef.current) field.onChange(value);
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
      </ScrollView>

      {/* Persistent save and cancel actions */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title="Cancel"
          variant="outline"
          className="flex-1"
          onPress={exit.requestExit}
          disabled={isSaving || form.formState.isSubmitting}
          rounded="full"
        />

        <Button
          title="Save Changes"
          className="flex-1"
          onPress={() => void form.handleSubmit(submitValues)()}
          loading={isSaving || form.formState.isSubmitting}
          disabled={!hasChanges}
          rounded="full"
        />
      </View>

      {/* Discard confirmation */}
      {discardDialog}
    </KeyboardAvoidingView>
  );
}
