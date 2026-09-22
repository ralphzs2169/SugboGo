import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatDate } from "@/shared/utils/date.utils";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import ApprovedApplicationSection from "../components/portal/ApprovedApplicationSection";
import MerchantBenefits from "../components/portal/MerchantBenefits";
import MerchantHero from "../components/portal/MerchantHero";
import MerchantRequirements from "../components/portal/MerchantRequirements";
import RejectionApplicationSection from "../components/portal/RejectedApplicationSection";
import ResumeApplicationSection from "../components/portal/ResumeApplicationSection";
import SubmittedApplicationSection from "../components/portal/SubmittedApplicationSection";
import useAcknowledgeMerchantMode from "../hooks/useAcknowledgeMerchantMode";
import { useMerchantPortalState } from "../hooks/useMerchantPortalState";

/**
 * Displays the merchant portal based on the user's current registration state.
 *
 * Renders registration progress, review status, approval details, and merchant
 * information while coordinating registration navigation and Merchant Mode
 * activation from the primary portal action.
 */
export default function MerchantPortalScreen() {
  const [isNavigating, setIsNavigating] = useState(false);

  const { registrationStatus, config, application, isLoading, error, refetch } =
    useMerchantPortalState();

  const { mutateAsync: acknowledgeMerchantMode, isPending: isAcknowledging } =
    useAcknowledgeMerchantMode();

  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  const isPrimaryActionPending = isNavigating || isAcknowledging;

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
      void refetch();
    }, [refetch]),
  );

  if (isLoading) {
    return (
      <LoadingScreen
        title="Loading Merchant Portal"
        description="Fetching your application status..."
      />
    );
  }

  if (error && !application) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title="Unable to load merchant portal"
          description="Please check your internet connection and try again."
          primaryActionTitle="Try Again"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const needsApplication =
    config.sections.progress ||
    config.sections.status ||
    config.sections.feedback ||
    config.sections.dashboard;

  if (needsApplication && !application) {
    return (
      <ErrorState
        title="Application unavailable"
        description="We couldn't load your merchant application."
        primaryActionTitle="Try Again"
        onPrimaryAction={refetch}
      />
    );
  }

  async function handlePrimaryAction() {
    if (isPrimaryActionPending) {
      return;
    }

    switch (registrationStatus) {
      case "NONE":
      case "DRAFT":
      case "REJECTED":
        setIsNavigating(true);

        requestAnimationFrame(() => {
          router.push("/(explorer)/merchant-registration");
        });
        break;

      case "SUBMITTED":
        setIsNavigating(true);

        requestAnimationFrame(() => {
          router.push(
            "/(explorer)/merchant-registration/submitted-application",
          );
        });
        break;

      case "APPROVED":
        try {
          await acknowledgeMerchantMode();

          setActiveMode("merchant");

          router.replace("/(merchant)/(tabs)/dashboard");
        } catch (error) {
          const response = error as ApiResponse<unknown>;

          if (handleSystemError(response)) {
            return;
          }

          Toast.show({
            type: "error",
            text1: "Unable to switch to Merchant Mode",
            text2:
              response.message || "Something went wrong. Please try again.",
          });
        }
        break;
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Refresh error */}
        {error && application && (
          <ErrorState
            size="section"
            title="Unable to refresh merchant portal"
            description="Showing your last available application details."
            primaryActionTitle="Try Again"
            onPrimaryAction={() => {
              void refetch();
            }}
          />
        )}

        {/* Merchant portal hero */}
        {config.hero && <MerchantHero />}

        {/* Registration progress */}
        {config.sections.progress && (
          <ResumeApplicationSection
            currentStep={application?.highest_completed_step ?? 1}
            totalSteps={5}
            lastUpdated={formatDate(application?.updated_at)}
          />
        )}

        {/* Submitted application */}
        {config.sections.status && (
          <SubmittedApplicationSection
            submittedAt={formatDate(application?.submitted_at)}
            estimatedReview={
              application
                ? `${application.review_sla_min_business_days}–${application.review_sla_max_business_days} business days`
                : undefined
            }
          />
        )}

        {/* Rejected application */}
        {config.sections.feedback && (
          <RejectionApplicationSection
            reviewedAt={formatDate(application?.reviewed_at)}
            feedback={application?.latest_review?.feedback ?? []}
          />
        )}

        {/* Approved application */}
        {config.sections.dashboard && (
          <ApprovedApplicationSection
            businessName={
              application?.identity?.business_name ?? "Your business"
            }
            approvedAt={formatDate(application?.reviewed_at)}
          />
        )}

        {/* Merchant information */}
        {(config.sections.benefits || config.sections.requirements) && (
          <View className="gap-2 bg-background py-2">
            {config.sections.benefits && (
              <View className="overflow-hidden rounded-md bg-surface">
                <MerchantBenefits />
              </View>
            )}

            {config.sections.requirements && (
              <View className="overflow-hidden rounded-md bg-surface">
                <MerchantRequirements />
              </View>
            )}
          </View>
        )}

        {/* Primary portal action */}
        <View className="bg-surface px-6 py-5">
          <Button
            title={config.primaryAction.buttonTitle}
            fontClassName="tracking wider"
            textWeight="bold"
            onPress={handlePrimaryAction}
            loading={isPrimaryActionPending}
            disabled={isPrimaryActionPending}
            rounded="full"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
