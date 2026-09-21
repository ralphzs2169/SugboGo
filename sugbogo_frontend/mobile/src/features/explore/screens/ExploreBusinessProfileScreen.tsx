import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import FullscreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { formatDistance } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessAboutContent from "../components/business-profile/BusinessAboutContent";
import BusinessPhotosSection from "../components/business-profile/BusinessPhotosSection";
import BusinessProfileFooter from "../components/business-profile/BusinessProfileFooter";
import BusinessProfileQuickInfo from "../components/business-profile/BusinessProfileQuickInfo";
import BusinessProfileScrollView from "../components/business-profile/BusinessProfileScrollView";
import BusinessProfileSection from "../components/business-profile/BusinessProfileSection";
import BusinessReviewsSection from "../components/business-profile/review-section/BusinessReviewsSection";
import BusinessProfileErrorState from "../components/business-profile/state/BusinessProfileErrorState";
import BusinessProfileSkeletonContent from "../components/business-profile/state/BusinessProfileSkeletonContent";
import BusinessSpecialtiesSection from "../components/business-profile/BusinessSpecialtiesSection";
import BusinessVisitInfoContent from "../components/business-profile/BusinessVisitInfoContent";
import ExploreBusinessHero from "../components/business-profile/ExploreBusinessHero";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import RideProviderSheet from "../components/business-profile/RideProviderSheet";
import SimilarPlacesSection from "../components/business-profile/SimilarPlacesSection";
import useBusinessProfileVisit from "../hooks/useBusinessProfileVisit";
import { useBusinessReviewPreview } from "../hooks/useBusinessReviews";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import type { BusinessReview } from "../types/review.types";
import {
  getBusinessHoursSummary,
  getQuickInfoStatus,
} from "../utils/businessHours.utils";

type Props = {
  businessId: number;
  distance: number | null;
  distanceAccuracy: number | null;
};

/**
 * Displays the public Explorer-facing profile of a business.
 *
 * Coordinates the profile sections, overlapping hero summary, review preview,
 * refresh behavior, photo gallery, review composer, and contextual visit
 * actions while keeping the scroll shell stable during profile loading.
 */
export default function ExploreBusinessProfileScreen({
  businessId,
  distance,
  distanceAccuracy,
}: Props) {
  const { business, error, refetch } = useExploreBusinessProfile(businessId);

  useBusinessProfileVisit(businessId, business?.id);

  const { totalCount: reviewCount } = useBusinessReviewPreview(businessId);

  useQueryErrorNotification({
    error,
    toastId: "business-profile-error",
    title: "Unable to load business profile",
    fallbackMessage: "We couldn't load this business right now.",
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );

  const composerRef = useRef<BottomSheetModal | null>(null);
  const rideProviderRef = useRef<BottomSheetModal | null>(null);

  const handleCreateReview = () => {
    setEditingReview(null);
    presentBottomSheet(composerRef);
  };

  const handleEditReview = (review: BusinessReview) => {
    setEditingReview(review);
    presentBottomSheet(composerRef);
  };

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

  const handleViewRoute = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/road-route",
      params: {
        businessId: String(businessId),
      },
    });
  };

  const handleJeepneyGuide = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/jeepney-guide",
      params: {
        businessId: String(businessId),
      },
    });
  };

  const handleRide = () => {
    presentBottomSheet(rideProviderRef);
  };

  if (error && !business) {
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

  const hoursSummary = business
    ? getBusinessHoursSummary(business.operating_hours)
    : null;

  const quickInfoStatus = hoursSummary
    ? getQuickInfoStatus(hoursSummary)
    : null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <BusinessProfileScrollView
        business={business}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        isOwnBusiness={business?.is_own_business ?? false}
      >
        {business && quickInfoStatus ? (
          <>
            {/* Business hero and overlapping quick info */}
            <View className=" bg-surface">
              <ExploreBusinessHero
                business={business}
                isOwnBusiness={business.is_own_business}
              />

              <View className="relative z-10 -mt-8 px-4">
                <BusinessProfileQuickInfo
                  reviewCount={reviewCount}
                  statusLabel={quickInfoStatus.statusLabel}
                  statusDetail={quickInfoStatus.statusDetail}
                  isOpenNow={quickInfoStatus.isOpen}
                  distance={
                    distance !== null
                      ? formatDistance(distance, distanceAccuracy)
                      : null
                  }
                />
              </View>
            </View>

            {/* Business specialties */}
            <BusinessSpecialtiesSection
              businessId={business.id}
              specialtyTags={business.specialty_tags}
              isOwnBusiness={business.is_own_business}
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

            {/* Visit and contact information */}
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
                onViewRoute={handleViewRoute}
                onJeepneyGuide={handleJeepneyGuide}
                onRide={handleRide}
                isOwnBusiness={business.is_own_business}
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
                isOwnBusiness={business.is_own_business}
                hasOwnReview={business.has_own_review}
                onWriteReview={handleCreateReview}
                onEditReview={handleEditReview}
              />
            </BusinessProfileSection>

            {/* Similar places */}
            <SimilarPlacesSection businessId={business.id} />
          </>
        ) : (
          <BusinessProfileSkeletonContent />
        )}
      </BusinessProfileScrollView>

      {/* Owner management action */}
      {business?.is_own_business && <BusinessProfileFooter isOwnBusiness />}

      {/* Review composer */}
      {business && (
        <ReviewComposerSheet
          businessId={business.id}
          sheetRef={composerRef}
          review={editingReview}
        />
      )}

      {/* Ride-provider selection */}
      {business && !business.is_own_business && (
        <RideProviderSheet sheetRef={rideProviderRef} />
      )}
    </SafeAreaView>
  );
}
