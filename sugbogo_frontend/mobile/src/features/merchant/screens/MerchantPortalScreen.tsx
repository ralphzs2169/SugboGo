import { ScrollView, View, Button } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MerchantHero from "../components/portal/MerchantHero";
import MerchantBenefits from "../components/portal/MerchantBenefits";
import MerchantRequirements from "../components/portal/MerchantRequirements";
import { MerchantRegistrationStatus } from "../types/merchant.types";
import { portalConfig } from "../utils/portalConfig";
import RegistrationProgressCard from "../components/portal/RegistrationProgressCard";
import ApplicationStatusCard from "../components/portal/ApplicationStatusCard";
import RejectionFeedbackCard from "../components/portal/RejectionFeedback";
import MerchantDashboardCard from "../components/portal/MerchantDashboardCard";
import { useMerchantPortalState } from "../hooks/useMerchantPortalState";

/**
 * MerchantPortalScreen serves as the entry point for all
 * merchant-related interactions.
 *
 * The screen is configuration-driven and renders different
 * sections depending on the user's current merchant
 * registration status.
 */
export default function MerchantPortalScreen() {
  const registrationStatus = MerchantRegistrationStatus.NONE; // This would typically come from user data or state
  const config = portalConfig[registrationStatus];

  // Will be used when backend integration is complete to fetch real data for the portal.
  //   const {
  //     registrationStatus,
  //     config,
  //     progress,
  //     application,
  //     feedback,
  //     merchant,
  //   } = useMerchantPortalState();
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MerchantHero
          title={config.hero.title}
          description={config.hero.description}
        />

        {config.sections.progress && (
          <RegistrationProgressCard
            currentStep={2}
            totalSteps={5}
            lastUpdated="July 27, 2026"
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
        {config.sections.benefits && <MerchantBenefits />}

        {config.sections.requirements && <MerchantRequirements />}

        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-6 py-5">
          <Button title={config.primaryAction.buttonTitle} onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
