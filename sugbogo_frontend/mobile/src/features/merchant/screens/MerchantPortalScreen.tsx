import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "@/shared/components/Button";
import MerchantHero from "../components/portal/MerchantHero";
import MerchantBenefits from "../components/portal/MerchantBenefits";
import MerchantRequirements from "../components/portal/MerchantRequirements";
import { MerchantRegistrationStatus } from "../types/merchant.types";
import { portalConfig } from "../utils/portalConfig.utils";
import RegistrationProgressCard from "../components/portal/RegistrationProgressCard";
import ApplicationStatusCard from "../components/portal/ApplicationStatusCard";
import RejectionFeedbackCard from "../components/portal/RejectionFeedback";
import MerchantDashboardCard from "../components/portal/MerchantDashboardCard";
import { useMerchantPortalState } from "../hooks/useMerchantPortalState";
import LoadingScreen from "@/shared/components/LoadingScreen";

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

  if (isLoading) {
    return (
      <LoadingScreen
        title="Loading Merchant Portal"
        description="Fetching your application status..."
      />
    );
  }
  console.log(application);
  console.log(registrationStatus);
  console.log(config);
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {config.hero && <MerchantHero />}

        {config.sections.progress && (
          <RegistrationProgressCard
            currentStep={application?.highest_completed_step ?? 1}
            totalSteps={5}
            lastUpdated={
              application?.updated_at
                ? new Date(application.updated_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""
            }
          />
        )}
        {config.sections.status && (
          <ApplicationStatusCard
            status="UNDER_REVIEW"
            submittedAt="July 27, 2026"
            estimatedReview="2–5 business days"
          />
        )}
        {config.sections.feedback && (
          <RejectionFeedbackCard
            reviewedAt="July 28, 2026"
            feedback={[
              "Business permit is blurry.",
              "Please upload a clearer storefront photo.",
            ]}
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

        <View className=" bg-surface px-6 py-5">
          <Button
            title={config.primaryAction.buttonTitle}
            fontClassName="font-bold tracking wider"
            onPress={() => router.push("/(explorer)/merchant-registration")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
