import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FullscreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";
import useLocalBusinessProfileMedia from "../../hooks/useLocalBusinessProfileMedia";
import type useBusinessDetailSource from "../../hooks/useBusinessDetailSource";
import LiveBusinessProfile, {
  LiveBusinessQuickInfo,
  LiveBusinessVisitActions,
  type BusinessProfileProps,
} from "../../screens/LiveBusinessProfile";
import BusinessProfileScrollView from "./BusinessProfileScrollView";
import BusinessProfileQuickInfo from "./BusinessProfileQuickInfo";
import BusinessProfileSection from "./BusinessProfileSection";
import BusinessProfileFooter from "./BusinessProfileFooter";
import BusinessAboutContent from "./BusinessAboutContent";
import BusinessVisitInfoContent from "./BusinessVisitInfoContent";
import BusinessPhotosSection from "./BusinessPhotosSection";
import BusinessSpecialtiesSection from "./BusinessSpecialtiesSection";
import BusinessSpecialtiesPresentation from "./BusinessSpecialtiesPresentation";
import ExploreBusinessHero from "./ExploreBusinessHero";
import BusinessProfileErrorState from "./state/BusinessProfileErrorState";
import BusinessProfileSkeletonContent from "./state/BusinessProfileSkeletonContent";

type Props = BusinessProfileProps & {
  sourceLabel?: string;
  extraBottomPadding?: number;
  detail: Omit<ReturnType<typeof useBusinessDetailSource>, "refetch"> & {
    refetch: () => Promise<unknown>;
  };
};

/** Keeps the normal scroll, hero and information shell mounted across source changes. */
export default function BusinessProfilePresentation({
  detail,
  sourceLabel,
  extraBottomPadding,
  ...props
}: Props) {
  const live = detail.source === "live" ? detail.business : null;
  const business = live ?? detail.snapshot?.business ?? null;
  const media = useLocalBusinessProfileMedia(
    business,
    !live,
    detail.localCoverUri,
  );
  const identity = business
    ? {
        id: business.id,
        business_name: business.business_name,
        cluster: business.cluster,
        category: business.category,
        display_cover_photo_url: media.cover,
        ...(live ? { is_pocketed: live.is_pocketed } : {}),
      }
    : null;
  const ownerPresentation = !!live?.is_own_business && !props.previewAsExplorer;
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  async function refreshProfile() {
    if (detail.isLoading || isPullRefreshing) return;
    setIsPullRefreshing(true);
    try {
      await detail.refetch();
    } finally {
      setIsPullRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <BusinessProfileScrollView
        impressionsEnabled={!galleryVisible}
        extraBottomPadding={extraBottomPadding}
        business={identity}
        isRefreshing={isPullRefreshing && !detail.isLoading}
        onRefresh={() => void refreshProfile()}
        isOwnBusiness={ownerPresentation}
      >
        {!business && !detail.isLoading ? (
          <BusinessProfileErrorState
            onRetry={() => void detail.refetch()}
            onGoBack={() => router.back()}
          />
        ) : (
          <>
            {!business && <BusinessProfileSkeletonContent />}
            <View
              style={!business ? { display: "none" } : undefined}
              accessibilityElementsHidden={!business}
              importantForAccessibility={
                !business ? "no-hide-descendants" : "auto"
              }
            >
              {/* Stable hero and overlapping information card */}
              <View className="bg-surface">
                <ExploreBusinessHero
                  business={identity}
                  isOwnBusiness={ownerPresentation}
                  onShare={() => {}}
                />
                <View className="relative z-10 -mt-8 px-4">
                  {live ? (
                    <LiveBusinessQuickInfo {...props} business={live} />
                  ) : (
                    <BusinessProfileQuickInfo
                      reviewCount={null}
                      statusLabel="Current status unavailable"
                      statusDetail=""
                      isOpenNow={null}
                      distance={null}
                      unavailable
                    />
                  )}
                </View>
              </View>
              {/* One contextual source label for the entire profile */}
              {!live && detail.snapshot && (
                <View className="flex-row items-start gap-2 bg-surface px-4 pt-3">
                  <MaterialCommunityIcons
                    name={
                      detail.source === "offline-pocket"
                        ? "download-outline"
                        : "history"
                    }
                    size={15}
                    color={theme.extends.colors.text.secondary}
                    style={{ marginTop: 2 }}
                    accessible={false}
                  />
                  <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-2">
                    <AppText
                      weight="medium"
                      className="text-xs leading-5 text-text-secondary"
                    >
                      {sourceLabel ??
                        (detail.source === "offline-pocket"
                          ? "Saved for offline"
                          : "Previously loaded")}
                    </AppText>
                    <AppText className="text-xs leading-5 text-text-tertiary">
                      Updated{" "}
                      {new Date(detail.snapshot.fetchedAt).toLocaleString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        },
                      )}
                    </AppText>
                  </View>
                </View>
              )}
              {live ? (
                <BusinessSpecialtiesSection
                  businessId={live.id}
                  specialtyTags={live.specialty_tags}
                  isOwnBusiness={live.is_own_business}
                  displayAsExplorer={props.previewAsExplorer}
                />
              ) : (
                <BusinessSpecialtiesPresentation
                  tags={business?.specialty_tags ?? []}
                  disabled
                />
              )}
              {/* About stays mounted, preserving its expansion state */}
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
                <BusinessAboutContent
                  description={business?.description ?? null}
                />
              </BusinessProfileSection>
              {/* Only existing local image files enter fallback photo/gallery presentation */}
              {(live || media.photos.length > 0) && (
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
                    photos={media.photos}
                    onPhotoPress={(index) => {
                      setGalleryIndex(index);
                      setGalleryVisible(true);
                    }}
                  />
                  {media.photos.length > 0 && (
                    <FullscreenPhotoViewer
                      photos={media.photos.map((photo) => ({
                        uri: photo.photo_url,
                        category: photo.category,
                      }))}
                      visible={galleryVisible}
                      initialIndex={Math.min(
                        galleryIndex,
                        media.photos.length - 1,
                      )}
                      onClose={() => setGalleryVisible(false)}
                    />
                  )}
                </BusinessProfileSection>
              )}
              {/* The same visit component retains its weekly-hours expansion */}
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
                  businessId={live?.id}
                  location={business?.location ?? null}
                  operatingHours={business?.operating_hours ?? []}
                  contactNumber={business?.contact_number ?? ""}
                  email={business?.email ?? null}
                  website={business?.website ?? null}
                  isOwnBusiness={ownerPresentation}
                  readOnly={!live}
                  transportActions={
                    live ? (
                      <LiveBusinessVisitActions {...props} business={live} />
                    ) : undefined
                  }
                />
              </BusinessProfileSection>
              {/* Network-owning review and recommendation behavior is never mounted locally */}
              {live ? (
                <LiveBusinessProfile {...props} business={live} />
              ) : (
                <BusinessProfileSection title="Reviews">
                  <View className="flex-row items-start gap-3 rounded-xl border border-border-primary/60 bg-surface-secondary p-4">
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
                      <MaterialCommunityIcons
                        name="message-text-outline"
                        size={19}
                        color={theme.extends.colors.text.secondary}
                        accessible={false}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <AppText
                        weight="semibold"
                        className="text-sm leading-5 text-text-primary"
                      >
                        Reviews need a connection
                      </AppText>
                      <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                        Connect to read reviews and share your experience.
                      </AppText>
                    </View>
                  </View>
                </BusinessProfileSection>
              )}
            </View>
          </>
        )}
      </BusinessProfileScrollView>
      {ownerPresentation && <BusinessProfileFooter isOwnBusiness />}
    </SafeAreaView>
  );
}
