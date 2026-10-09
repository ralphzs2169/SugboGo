import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
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
import LoadingScreen from "@/shared/components/LoadingScreen";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateMerchantBusinessInformation from "../../hooks/business-profile/useUpdateMerchantBusinessInformation";
import { merchantBusinessInformationSchema } from "../../validation/merchantBusinessInformation.schema";

type BusinessInformationForm = z.infer<
  typeof merchantBusinessInformationSchema
>;

/**
 * Allows merchants to edit their business description and contact details.
 *
 * Displays full-width guidance for direct updates, initializes the form
 * with existing business information, validates changes, and handles
 * server errors. Editing is unavailable for suspended businesses.
 */
export default function MerchantBusinessInformationEditScreen() {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const initializedBusinessId = useRef<number | null>(null);

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();

  const { updateInformation, isSaving } = useUpdateMerchantBusinessInformation(
    business?.id,
  );

  const form = useForm<BusinessInformationForm>({
    resolver: zodResolver(merchantBusinessInformationSchema),
    defaultValues: {
      businessDescription: "",
      contactNumber: "",
      businessEmail: "",
      website: "",
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (!business || initializedBusinessId.current === business.id) {
      return;
    }

    initializedBusinessId.current = business.id;

    reset({
      businessDescription: business.description ?? "",
      contactNumber: business.contact_number,
      businessEmail: business.business_email ?? "",
      website: business.website ?? "",
    });
  }, [business, reset]);

  async function submitValues(values: BusinessInformationForm) {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;

    try {
      await updateInformation({
        description: values.businessDescription,
        contact_number: values.contactNumber,
        business_email: values.businessEmail,
        website: values.website,
      });

      Toast.show({
        type: "success",
        text1: "Business information updated",
      });

      router.back();
    } catch (error) {
      const response = error as ApiError;

      if (response.code === "VALIDATION_ERROR") {
        const fields = {
          description: "businessDescription",
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
      savingRef.current = false;
    }
  }

  // Initial business loading state
  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Business Information"
        description="Fetching your current details..."
      />
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
                You can update your business description and contact details
                without administrator approval. Changes will appear on your
                business listing after saving.
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
                value={field.value}
                onChangeText={field.onChange}
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
                value={field.value}
                onChangeText={field.onChange}
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
                value={field.value}
                onChangeText={field.onChange}
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
                value={field.value}
                onChangeText={field.onChange}
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
          onPress={() => router.back()}
          disabled={isSaving || form.formState.isSubmitting}
          rounded="full"
        />

        <Button
          title="Save Changes"
          className="flex-1"
          onPress={() => void form.handleSubmit(submitValues)()}
          loading={isSaving || form.formState.isSubmitting}
          rounded="full"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
