import { zodResolver } from "@hookform/resolvers/zod";
import { router, useFocusEffect, useNavigation, type Href } from "expo-router";
import { HeaderBackButton } from "expo-router/build/react-navigation/elements/Header/HeaderBackButton";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import FormInput from "@/shared/components/form/FormInput";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { getFieldError, handleSystemError } from "@/shared/utils/apiErrors";

import BusinessNameChangeComparison from "../../components/business-name-change/BusinessNameChangeComparison";
import MerchantChangeCooldownState from "../../components/change-requests/MerchantChangeCooldownState";
import RegistrationSection from "../../components/registration/RegistrationSection";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import {
  useMerchantBusinessNameChangeRequests,
  useSubmitMerchantBusinessNameChange,
} from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import useMerchantChangeEligibilityRefresh from "../../hooks/change-requests/useMerchantChangeEligibilityRefresh";
import { businessNameChangeSchema } from "../../validation/businessNameChange.schema";

type NameChangeForm = z.infer<typeof businessNameChangeSchema>;

/** Reviews one changed business name and protects an unfinished request on exit. */
export default function BusinessNameChangeRequestScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const hasChangesRef = useRef(false);
  const initializedBusinessId = useRef<number | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const {
    business,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMerchantBusinessProfile();
  const {
    eligibility,
    pendingRequest,
    hasData: hasRequestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useMerchantBusinessNameChangeRequests();
  useMerchantChangeEligibilityRefresh(eligibility, refetchRequests);
  const submitRequest = useSubmitMerchantBusinessNameChange();
  const form = useForm<NameChangeForm>({
    resolver: zodResolver(businessNameChangeSchema),
    defaultValues: { proposedBusinessName: "" },
  });
  const proposedBusinessName = useWatch({
    control: form.control,
    name: "proposedBusinessName",
  });
  const hasChanges = Boolean(
    business &&
    form.formState.isDirty &&
    proposedBusinessName.trim() !== business.business_name.trim(),
  );

  useEffect(() => {
    if (!business || initializedBusinessId.current === business.id) {
      return;
    }
    initializedBusinessId.current = business.id;
    form.reset({ proposedBusinessName: business.business_name });
  }, [business, form]);

  useLayoutEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  const requestExit = useCallback(() => {
    if (submittingRef.current || submittedRef.current) {
      return;
    }
    if (hasChangesRef.current) {
      setDiscardVisible(true);
      return;
    }
    router.back();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton onPress={requestExit} />,
    });
  }, [navigation, requestExit]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          requestExit();
          return true;
        },
      );
      return () => subscription.remove();
    }, [requestExit]),
  );

  useQueryErrorNotification({
    error: requestsError ?? profileError,
    toastId: "business-name-change-form-requests-error",
    title: "Unable to check pending requests",
    fallbackMessage: "Please try again.",
  });

  async function submitValues(values: NameChangeForm) {
    if (
      submittingRef.current ||
      submitRequest.isPending ||
      pendingRequest ||
      !business ||
      !isReviewing
    ) {
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
    setIsSubmittingRequest(true);
    try {
      const created = await submitRequest.mutateAsync(
        values.proposedBusinessName,
      );
      Toast.show({
        type: "success",
        text1: "Name change requested",
        text2: "Your current name stays visible until Admin approval.",
      });
      submittedRef.current = true;
      router.replace(
        `/(merchant)/business-update-requests/${created.id}` as Href,
      );
    } catch (error) {
      setIsSubmittingRequest(false);
      const response = error as ApiError;
      const cooldownBlocked = response.errors?.reason?.[0] === "cooldown";

      if (cooldownBlocked) {
        await refetchRequests();
        Toast.show({
          type: "info",
          text1: "Name change temporarily unavailable",
          text2: response.message,
        });
        return;
      }

      const fieldMessage = getFieldError(response, "proposed_business_name");
      if (fieldMessage) {
        form.setError("proposedBusinessName", {
          type: "server",
          message: fieldMessage,
        });
        setIsReviewing(false);
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

  function reviewRequest(values: NameChangeForm) {
    if (!business || !hasChanges) {
      return;
    }
    if (values.proposedBusinessName === business.business_name.trim()) {
      form.setError("proposedBusinessName", {
        type: "manual",
        message: "Choose a different business name.",
      });
      return;
    }
    setIsReviewing(true);
  }

  if (
    (isProfileLoading && !business) ||
    isRequestsLoading ||
    (!hasRequestsData && !requestsError)
  ) {
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

  if (pendingRequest && !isSubmittingRequest) {
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

  if (
    eligibility?.reason === "cooldown" &&
    eligibility.cooldown_until &&
    eligibility.last_approved_request_id
  ) {
    return (
      <MerchantChangeCooldownState
        description="Your recent business name change was approved. You can submit another request after the waiting period."
        cooldownDurationHours={eligibility.cooldown_duration_hours}
        cooldownUntil={eligibility.cooldown_until}
        onViewApprovedRequest={() =>
          router.push(
            `/(merchant)/business-update-requests/${eligibility.last_approved_request_id}` as Href,
          )
        }
        onGoBack={() => router.back()}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      {/* Name edit and change review */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pt-2"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {isReviewing ? (
          <BusinessNameChangeComparison
            previousName={business.business_name}
            proposedName={proposedBusinessName.trim()}
          />
        ) : (
          <RegistrationSection
            title="Business name"
            icon="store-edit-outline"
            description="Choose the name customers should see after approval."
          >
            <AppText className="text-xs text-text-secondary">
              Currently live
            </AppText>
            <AppText
              weight="semibold"
              className="mt-1 mb-5 text-base text-text-primary"
            >
              {business.business_name}
            </AppText>
            <Controller
              control={form.control}
              name="proposedBusinessName"
              render={({ field, fieldState }) => (
                <FormInput
                  label="Proposed business name"
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
          </RegistrationSection>
        )}
        <AppText className="mx-6 mt-3 text-sm leading-5 text-text-secondary">
          Your current business name stays visible until an Admin approves the
          request.
        </AppText>
      </ScrollView>

      {/* Submission controls */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title={isReviewing ? "Edit" : "Cancel"}
          variant="outline"
          className="flex-1"
          onPress={() => (isReviewing ? setIsReviewing(false) : requestExit())}
          disabled={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />
        <Button
          title={isReviewing ? "Submit Request" : "Review Changes"}
          className="flex-1"
          onPress={() =>
            void form.handleSubmit(isReviewing ? submitValues : reviewRequest)()
          }
          disabled={
            submitRequest.isPending ||
            isSubmittingRequest ||
            (!isReviewing && !hasChanges)
          }
          loading={submitRequest.isPending || isSubmittingRequest}
          rounded="full"
        />
      </View>

      {/* Discard confirmation */}
      <ConfirmModal
        visible={discardVisible}
        title="Discard name change?"
        message="Your current business name will remain unchanged."
        confirmText="Discard"
        destructive
        onCancel={() => setDiscardVisible(false)}
        onConfirm={() => {
          setDiscardVisible(false);
          router.back();
        }}
      />
    </KeyboardAvoidingView>
  );
}
