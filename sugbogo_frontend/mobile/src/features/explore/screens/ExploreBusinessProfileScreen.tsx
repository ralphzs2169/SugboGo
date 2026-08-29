import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";

import type { BusinessReview } from "../types/review.types";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";

import { theme } from "@/constants/theme";
import Skeleton from "@/shared/components/Skeleton";
import FixedFooter from "@/shared/components/FixedFooter";

import FullscreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";

import BusinessProfileSkeletonContent from "../components/business-profile/state/BusinessProfileSkeletonContent";
import BusinessProfileErrorState from "../components/business-profile/state/BusinessProfileErrorState";
import ExploreBusinessHero from "../components/business-profile/ExploreBusinessHero";
import BusinessProfileQuickInfo from "../components/business-profile/BusinessProfileQuickInfo";
import BusinessProfileScrollView from "../components/business-profile/BusinessProfileScrollView";
import BusinessSpecialtiesSection from "../components/business-profile/BusinessSpecialtiesSection";
import BusinessAboutContent from "../components/business-profile/BusinessAboutContent";
import BusinessPhotosSection from "../components/business-profile/BusinessPhotosSection";
import BusinessReviewsSection from "../components/business-profile/review-section/BusinessReviewsSection";
import BusinessProfileSection from "../components/business-profile/BusinessProfileSection";
import BusinessVisitInfoContent from "../components/business-profile/BusinessVisitInfoContent";
import BusinessProfileFooter from "../components/business-profile/BusinessProfileFooter";

import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import { useBusinessReviewPreview } from "../hooks/useBusinessReviews";

import {
  getBusinessHoursSummary,
  getQuickInfoStatus,
} from "../utils/businessHours.utils";

import { formatDistance } from "@/shared/utils/distance.utils";

type Props = {
  businessId: number;
  distance: number | null;
  distanceAccuracy: number | null;
};

/**
 * Displays the public Explorer-facing profile of a business.
 *
 * Coordinates the profile sections, business review preview, refresh behavior,
 * photo gallery, review composer, and contextual footer actions.
 *
 * The SafeAreaView/BusinessProfileScrollView shell stays mounted across the
 * loading -> loaded transition; only the scroll view's children (and the
 * footer) swap between skeleton placeholders and real content. This keeps
 * scroll position and the sticky header's animation state intact instead
 * of resetting when `business` finishes loading, which is what happened
 * when the skeleton was rendered as a fully separate screen.
 */
export default function ExploreBusinessProfileScreen({
  businessId,
  distance,
  distanceAccuracy,
}: Props) {
  const { business, isLoading, error, refetch } =
    useExploreBusinessProfile(businessId);

  const { totalCount: reviewCount } = useBusinessReviewPreview(businessId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const composerRef = useRef<BottomSheetModal | null>(null);

  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );

  const handleCreateReview = () => {
    setEditingReview(null);
    composerRef.current?.present();
  };

  const handleEditReview = (review: BusinessReview) => {
    setEditingReview(review);
    composerRef.current?.present();
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

  const handleGetDirections = () => {
    // Navigation integration will be added here.
  };

  // A hard fetch failure (no cached business to fall back on) still gets
  // its own screen — there's nothing to keep the scroll shell mounted for.
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
            {/* Business hero */}
            <ExploreBusinessHero
              business={business}
              isOwnBusiness={business.is_own_business}
            />

            {/* Quick info */}
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
                onEditReview={handleEditReview}
              />
            </BusinessProfileSection>
          </>
        ) : (
          <BusinessProfileSkeletonContent />
        )}
      </BusinessProfileScrollView>

      {/* Footer */}
      {business ? (
        <BusinessProfileFooter
          isOwnBusiness={business.is_own_business}
          hasOwnReview={business.has_own_review}
          onGetDirections={handleGetDirections}
          onWriteReview={handleCreateReview}
        />
      ) : (
        <FixedFooter>
          <View className="flex-row gap-3">
            {/* Secondary CTA */}
            <Skeleton className="h-12 flex-1 rounded-full" />

            {/* Primary CTA */}
            <View className="flex-1 overflow-hidden rounded-full">
              <View className="h-12 bg-brand/30" />
            </View>
          </View>
        </FixedFooter>
      )}

      {/* Review composer */}
      {business && (
        <ReviewComposerSheet
          businessId={business.id}
          sheetRef={composerRef}
          review={editingReview}
        />
      )}
    </SafeAreaView>
  );
}
