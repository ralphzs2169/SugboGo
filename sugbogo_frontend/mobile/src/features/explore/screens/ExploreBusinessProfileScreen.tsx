import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";

import ExploreBusinessHero from "../components/business-profile/ExploreBusinessHero";
import BusinessProfileScrollView from "../components/business-profile/BusinessProfileScrollView";
import BusinessSpecialtiesSection from "../components/business-profile/BusinessSpecialtiesSection";
import BusinessAboutSection from "../components/business-profile/BusinessAboutSection";
import BusinessLocationSection from "../components/business-profile/BusinessLocationSection";
import BusinessPhotosSection from "../components/business-profile/BusinessPhotosSection";
import BusinessHoursSection from "../components/business-profile/BusinessHoursSection";

import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";

type Props = {
  businessId: number;
};

/**
 * Displays the public Explorer-facing profile of a business.
 *
 * The page presents the business as a discovery destination and coordinates
 * its profile sections while keeping loading, error, and refresh behavior
 * at the page level.
 */
export default function ExploreBusinessProfileScreen({ businessId }: Props) {
  const { business, isLoading, error, refetch } =
    useExploreBusinessProfile(businessId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Business"
        description="Fetching business information..."
      />
    );
  }

  if (!business) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <ErrorState
          title="Unable to load business"
          description="We couldn't load this business information. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <BusinessProfileScrollView
        business={business}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
        {/* Business hero */}
        <ExploreBusinessHero business={business} />

        {/* Business specialties */}
        <BusinessSpecialtiesSection
          businessId={business.id}
          specialtyTags={business.specialty_tags}
        />

        {/* Business about */}
        <BusinessAboutSection description={business.description} />

        {/* Business location */}
        <BusinessLocationSection
          location={business.location}
          onGetDirections={() => {
            // Navigation integration will be added here.
          }}
        />

        {/* Business photos */}
        <BusinessPhotosSection photos={business.photos} onViewAll={() => {}} />

        {/* Business hours */}
        <BusinessHoursSection
          operatingHours={business.operating_hours}
          onViewFullHours={() => {}}
        />
      </BusinessProfileScrollView>
    </SafeAreaView>
  );
}
