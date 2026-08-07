import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { formatDate } from "@/shared/utils/date.utils";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ApplicationStatusCard from "../components/portal/ApplicationStatusCard";
import MerchantBenefits from "../components/portal/MerchantBenefits";
import MerchantDashboardCard from "../components/portal/MerchantDashboardCard";
import MerchantHero from "../components/portal/MerchantHero";
import MerchantRequirements from "../components/portal/MerchantRequirements";
import RegistrationProgressCard from "../components/portal/RegistrationProgressCard";
import RejectionFeedbackCard from "../components/portal/RejectionFeedback";
import { useMerchantPortalState } from "../hooks/useMerchantPortalState";

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

  const handlePrimaryAction = () => {
    switch (registrationStatus) {
      case "NONE":
      case "DRAFT":
      case "REJECTED":
        router.push("/(explorer)/merchant-registration");
        break;

      case "SUBMITTED":
      case "APPROVED":
        router.push("/(explorer)/merchant-registration/submitted-application");
        break;
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {config.hero && <MerchantHero />}

        {config.sections.progress && (
          <RegistrationProgressCard
            currentStep={application?.highest_completed_step ?? 1}
            totalSteps={5}
            lastUpdated={formatDate(application?.updated_at)}
          />
        )}

        {config.sections.status && (
          <ApplicationStatusCard
            status="UNDER_REVIEW"
            submittedAt={formatDate(application?.submitted_at)}
            estimatedReview="2–5 business days"
          />
        )}

        {config.sections.feedback && (
          <RejectionFeedbackCard
            reviewedAt={formatDate(application?.reviewed_at)}
            feedback={application?.feedback ?? []}
          />
        )}

        {config.sections.dashboard && (
          <MerchantDashboardCard
            businessName="Cafe Sugbo"
            approvedAt="July 30, 2026"
            onOpenDashboard={() => {}}
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
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
