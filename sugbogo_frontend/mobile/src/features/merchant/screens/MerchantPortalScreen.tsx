import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { formatDate } from "@/shared/utils/date.utils";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SubmittedApplicationSection from "../components/portal/SubmittedApplicationSection";
import MerchantBenefits from "../components/portal/MerchantBenefits";
import MerchantHero from "../components/portal/MerchantHero";
import MerchantRequirements from "../components/portal/MerchantRequirements";
import ResumeApplicationSection from "../components/portal/ResumeApplicationSection";
import RejectionApplicationSection from "../components/portal/RejectedApplicationSection";
import { useMerchantPortalState } from "../hooks/useMerchantPortalState";
import ApprovedApplicationSection from "../components/portal/ApprovedApplicationSection";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import useAcknowledgeMerchantMode from "../hooks/useAcknowledgeMerchantMode";
import { handleSystemError } from "@/shared/utils/apiErrors";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { Toast } from "react-native-toast-message/lib/src/Toast";

function SectionDivider() {
  return <View className="mx-6 mt-3" />;
}

/**
 * MerchantPortalScreen serves as the entry point for all
 * merchant-related interactions.
 *
 * The screen is configuration-driven and renders different
 * sections depending on the user's current merchant
 * registration status.
 */
export default function MerchantPortalScreen() {
  const { registrationStatus, config, application, isLoading, error, refetch } =
    useMerchantPortalState();

  const { mutateAsync: acknowledgeMerchantMode, isPending: isAcknowledging } =
    useAcknowledgeMerchantMode();

  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  useFocusEffect(
    useCallback(() => {
      refetch();
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

  if (error) {
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

  const handlePrimaryAction = async () => {
    switch (registrationStatus) {
      case "NONE":
      case "DRAFT":
      case "REJECTED":
        router.push("/(explorer)/merchant-registration");
        break;

      case "SUBMITTED":
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
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {config.hero && <MerchantHero />}

        {config.sections.progress && (
          <ResumeApplicationSection
            currentStep={application?.highest_completed_step ?? 1}
            totalSteps={5}
            lastUpdated={formatDate(application?.updated_at)}
          />
        )}

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

        {config.sections.benefits && (
          <>
            <SectionDivider />
            <MerchantBenefits />
          </>
        )}

        {config.sections.requirements && (
          <>
            <SectionDivider />
            <MerchantRequirements />
          </>
        )}

        <View className="bg-surface px-6 py-5">
          <Button
            title={config.primaryAction.buttonTitle}
            fontClassName="font-bold tracking wider"
            onPress={handlePrimaryAction}
            loading={isAcknowledging}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
