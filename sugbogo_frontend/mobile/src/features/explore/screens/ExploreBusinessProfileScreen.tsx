import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

import BusinessProfileSkeleton from "../components/business-profile/state/BusinessProfileSkeleton";

import ExploreBusinessHero from "../components/business-profile/ExploreBusinessHero";
import BusinessProfileQuickInfo from "../components/business-profile/BusinessProfileQuickInfo";
import BusinessProfileScrollView from "../components/business-profile/BusinessProfileScrollView";
import BusinessSpecialtiesSection from "../components/business-profile/BusinessSpecialtiesSection";
import BusinessAboutContent from "../components/business-profile/BusinessAboutContent";

import BusinessPhotosSection from "../components/business-profile/BusinessPhotosSection";

import BusinessReviewsSection from "../components/business-profile/BusinessReviewsSection";

import {
  getBusinessHoursSummary,
  getQuickInfoStatus,
} from "../utils/businessHours.utils";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import { formatDistance } from "@/shared/utils/distance.utils";
import { useBusinessReviews } from "../hooks/useBusinessReviews";
import BusinessProfileSection from "../components/business-profile/BusinessProfileSection";
import BusinessVisitInfoContent from "../components/business-profile/BusinessVisitInfoContent";
import FullscreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import BusinessProfileErrorState from "../components/business-profile/state/BusinessProfileErrorState";

type Props = {
  businessId: number;
  distance: number | null;
  distanceAccuracy: number | null;
};

/**
 * Displays the public Explorer-facing profile of a business.
 *
 * The page presents the business as a discovery destination and coordinates
 * its profile sections while keeping loading, error, and refresh behavior
 * at the page level.
 */
export default function ExploreBusinessProfileScreen({
  businessId,
  distance,
  distanceAccuracy,
}: Props) {
  const { business, isLoading, error, refetch } =
    useExploreBusinessProfile(businessId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const { totalCount } = useBusinessReviews(businessId);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const handlePhotoPress = (index: number) => {
    setGalleryIndex(index);
    setGalleryVisible(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGetDirections = () => {
    // Navigation integration will be added here.
  };

  if (isLoading && !business) {
    return <BusinessProfileSkeleton />;
  }

  if (!business) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <BusinessProfileErrorState
          onRetry={refetch}
          onGoBack={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const hoursSummary = getBusinessHoursSummary(business.operating_hours);
  const quickInfoStatus = getQuickInfoStatus(hoursSummary);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <BusinessProfileScrollView
        business={business}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
        {/* Business hero */}
        <ExploreBusinessHero business={business} />

        {/* Quick info */}
        <BusinessProfileQuickInfo
          reviewCount={totalCount}
          statusLabel={quickInfoStatus.statusLabel}
          statusDetail={quickInfoStatus.statusDetail}
          isOpenNow={quickInfoStatus.isOpen}
          distance={
            distance !== null
              ? formatDistance(distance, distanceAccuracy)
              : null
          }
        />
        {/* Business specialties */}
        <BusinessSpecialtiesSection
          businessId={business.id}
          specialtyTags={business.specialty_tags}
        />

        {/* Business about */}
        <BusinessProfileSection
          title="About this place"
          icon={
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <BusinessAboutContent description={business.description} />
        </BusinessProfileSection>

        {/* Visit & contact */}
        <BusinessProfileSection
          title="Plan Your Visit"
          icon={
            <MaterialCommunityIcons
              name="calendar-clock-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <BusinessVisitInfoContent
            location={business.location}
            operatingHours={business.operating_hours}
            contactNumber={business.contact_number}
            email={business.email}
            website={business.website}
            onGetDirections={handleGetDirections}
          />
        </BusinessProfileSection>

        {/* Business photos */}
        <BusinessProfileSection
          title="See What’s Here"
          icon={
            <MaterialCommunityIcons
              name="image-multiple-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          }
        >
          <BusinessPhotosSection
            photos={business.photos}
            onPhotoPress={handlePhotoPress}
          />

          <FullscreenPhotoViewer
            photos={business.photos.map((photo) => ({
              uri: photo.photo_url,
              category: photo.category,
            }))}
            visible={galleryVisible}
            initialIndex={galleryIndex}
            onClose={() => setGalleryVisible(false)}
          />
        </BusinessProfileSection>

        {/* Business reviews */}
        <BusinessProfileSection>
          <BusinessReviewsSection
            businessId={business.id}
            businessName={business.business_name}
          />
        </BusinessProfileSection>
      </BusinessProfileScrollView>
    </SafeAreaView>
  );
}
