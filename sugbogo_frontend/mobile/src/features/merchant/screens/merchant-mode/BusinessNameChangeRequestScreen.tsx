import { zodResolver } from "@hookform/resolvers/zod";
import { router, type Href } from "expo-router";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormInput from "@/shared/components/form/FormInput";
import LoadingScreen from "@/shared/components/LoadingScreen";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantBusinessNameChangeRequests,
  useSubmitMerchantBusinessNameChange,
} from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import { businessNameChangeSchema } from "../../validation/businessNameChange.schema";

type NameChangeForm = z.infer<typeof businessNameChangeSchema>;

/** Submits one name proposal while keeping the approved business name visible. */
export default function BusinessNameChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const submittingRef = useRef(false);
  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();
  const {
    pendingRequest,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMerchantBusinessNameChangeRequests();
  const submitRequest = useSubmitMerchantBusinessNameChange();
  const form = useForm<NameChangeForm>({
    resolver: zodResolver(businessNameChangeSchema),
    defaultValues: { proposedBusinessName: "" },
  });

  useQueryErrorNotification({
    error: requestsError ?? profileError,
    toastId: "business-name-change-form-requests-error",
    title: "Unable to check pending requests",
    fallbackMessage: "Please try again.",
  });

  async function submitValues(values: NameChangeForm) {
    if (submittingRef.current || submitRequest.isPending || pendingRequest) {
      return;
    }

    if (values.proposedBusinessName === business?.business_name.trim()) {
      form.setError("proposedBusinessName", {
        type: "manual",
        message: "Choose a different business name.",
      });
      return;
    }

    submittingRef.current = true;
    try {
      await submitRequest.mutateAsync(values.proposedBusinessName);
      Toast.show({
        type: "success",
        text1: "Name change requested",
        text2: "Your current name stays visible until Admin approval.",
      });
      router.replace("/(merchant)/business-update-requests" as Href);
    } catch (error) {
      const response = error as ApiError;
      const fieldMessage = getFieldError(response, "proposed_business_name");
      if (fieldMessage) {
        form.setError("proposedBusinessName", {
          type: "server",
          message: fieldMessage,
        });
      } else if (
        response.code === "VALIDATION_ERROR" &&
        response.message.toLowerCase().includes("already pending")
      ) {
        await refetchRequests();
        Toast.show({
          type: "error",
          text1: "Request already pending",
          text2: response.message,
        });
        router.replace("/(merchant)/business-update-requests" as Href);
      } else if (!handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to submit request",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      submittingRef.current = false;
    }
  }

  if ((isProfileLoading && !business) || isRequestsLoading) {
    return (
      <LoadingScreen
        title="Loading Name Change"
        description="Checking your business and requests..."
      />
    );
  }

  if (!business || requestsError) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Unable to load name changes"
          description="Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() =>
            void (business ? refetchRequests() : refetchProfile())
          }
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (business.status === "suspended") {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Request unavailable"
          description="Name changes cannot be requested while your business is suspended."
          primaryActionTitle="Go Back"
          onPrimaryAction={() => router.back()}
        />
      </View>
    );
  }

  if (pendingRequest) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          title="Pending Admin review"
          description={`Your request for ${pendingRequest.proposed_business_name} is already pending. Your current name remains ${business.business_name}.`}
          primaryActionTitle="View Request"
          onPrimaryAction={() =>
            router.replace(
              `/(merchant)/business-update-requests/${pendingRequest.id}` as Href,
            )
          }
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* Current name and proposed change */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="rounded-card border border-border-primary bg-surface p-4">
          <AppText className="text-xs text-text-secondary">
            Current Business Name
          </AppText>
          <AppText weight="bold" className="mt-1 text-base text-text-primary">
            {business.business_name}
          </AppText>
        </View>
        <View className="mt-5">
          <Controller
            control={form.control}
            name="proposedBusinessName"
            render={({ field, fieldState }) => (
              <FormInput
                label="Requested New Name"
                required
                minLength={2}
                maxLength={150}
                placeholder="Enter your proposed business name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        <AppText className="mt-3 text-sm leading-5 text-text-secondary">
          Your current business name will remain visible until an Admin approves
          this request.
        </AppText>
      </ScrollView>

      {/* Submission controls */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title="Cancel"
          variant="outline"
          className="flex-1"
          onPress={() => router.back()}
          disabled={submitRequest.isPending}
        />
        <Button
          title="Submit Request"
          className="flex-1"
          onPress={() => void form.handleSubmit(submitValues)()}
          loading={submitRequest.isPending || form.formState.isSubmitting}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
