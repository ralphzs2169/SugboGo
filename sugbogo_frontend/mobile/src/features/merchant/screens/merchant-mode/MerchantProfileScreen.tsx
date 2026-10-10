import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getBusinessHoursSummary } from "@/features/explore/utils/businessHours.utils";
import ProfileMenuItem from "@/features/profile/components/ProfileMenuItem";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { formatRetryTime } from "@/shared/utils/date.utils";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import HoursCardIcon from "../../assets/icons/hours-card.svg";
import LandmarksCardIcon from "../../assets/icons/landmarks-card.svg";
import PhotosCardIcon from "../../assets/icons/photos-card.svg";
import MerchantBusinessDetails from "../../components/business-profile/MerchantBusinessDetails";
import { getMerchantVerificationDocumentAccess } from "../../api/merchantBusinessProfile.service";
import MerchantBusinessStory from "../../components/business-profile/MerchantBusinessStory";
import MerchantProfileHeader from "../../components/business-profile/MerchantProfileHeader";
import MerchantProfileSkeleton from "../../components/business-profile/MerchantProfileSkeleton";
import MerchantProfileStickyHeader from "../../components/business-profile/MerchantProfileStickyHeader";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateBusinessCoverPhoto from "../../hooks/business-profile/useUpdateBusinessCoverPhoto";
import { useMerchantBusinessNameChangeRequests } from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import { useMerchantClassificationChangeRequests } from "../../hooks/classification-change/useMerchantClassificationChanges";
import { useMerchantLocationChangeRequests } from "../../hooks/location-change/useMerchantLocationChanges";
import useClusters from "../../hooks/registration/useClusters";

const STICKY_REVEAL_INSET = 64;

/**
 * Displays the merchant's live listing as a scannable profile with a cover,
 * overview metrics, business story, photos, and practical detail cards.
 * Preserves review shortcuts, cover editing, sticky identity, and Explorer mode.
 */
export default function MerchantProfileScreen() {
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);
  const { logout } = useLogout();
  const merchantAvatarUrl = useAuthStore(
    (state) => state.user?.avatar_url ?? null,
  );
  const merchantAvatarKey = useAuthStore(
    (state) => state.user?.avatar_key ?? null,
  );
  const bottomSpacing = useTabBarSpacing();

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();
  const { clusters } = useClusters();
  const documentAccess = useMutation({
    mutationFn: async (documentId: number) =>
      throwOnApiError(await getMerchantVerificationDocumentAccess(documentId)),
  });

  const {
    pendingRequest,
    isLoading: isCheckingName,
    isRefetching: isRefetchingName,
    error: nameError,
    refetch: refetchRequests,
  } = useMerchantBusinessNameChangeRequests();
  const {
    pendingRequest: pendingClassificationRequest,
    isLoading: isCheckingClassification,
    isRefetching: isRefetchingClassification,
    error: classificationError,
    refetch: refetchClassification,
  } = useMerchantClassificationChangeRequests();
  const {
    pendingRequest: pendingLocationRequest,
    isLoading: isCheckingLocation,
    isRefetching: isRefetchingLocation,
    error: locationError,
    refetch: refetchLocation,
  } = useMerchantLocationChangeRequests();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const heroHeightRef = useRef(0);
  const stickyVisibleRef = useRef(false);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const [stickyOpacity] = useState(() => new Animated.Value(0));
  const [stickyTranslateY] = useState(() => new Animated.Value(-16));

  useQueryErrorNotification({
    error,
    toastId: "merchant-business-profile-error",
    title: "Unable to load business profile",
    fallbackMessage: "Please try again.",
  });
  useQueryErrorNotification({
    error: nameError ?? classificationError ?? locationError,
    toastId: "merchant-profile-change-request-status-error",
    title: "Unable to check update requests",
    fallbackMessage: "Some request statuses couldn't be loaded.",
  });

  const { updateCoverPhoto, isUploading } = useUpdateBusinessCoverPhoto(
    business?.id,
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchRequests(),
        refetchClassification(),
        refetchLocation(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleSwitchToExplorer() {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    setActiveMode("explorer");
    router.replace("/(explorer)/(tabs)/explore");
    Toast.show({ type: "info", text1: "Switched to Explorer Mode" });
  }

  function handleManageBusiness() {
    router.push("/(merchant)/manage-business" as Href);
  }

  async function handleViewDocument(documentId: number) {
    if (documentAccess.isPending) return;

    try {
      const access = await documentAccess.mutateAsync(documentId);
      await WebBrowser.openBrowserAsync(access.url);
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to open document",
        text2: "Please try again.",
      });
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (heroHeightRef.current === 0) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const shouldShow = offsetY >= heroHeightRef.current - STICKY_REVEAL_INSET;
    if (shouldShow === stickyVisibleRef.current) return;

    stickyVisibleRef.current = shouldShow;
    setIsStickyVisible(shouldShow);
    Animated.parallel([
      Animated.timing(stickyOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(stickyTranslateY, {
        toValue: shouldShow ? 0 : -16,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePreview() {
    if (!business) return;
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: String(business.id),
        previewAsExplorer: "1",
      },
    });
  }

  async function handleEditCover(imageUri: string) {
    try {
      await updateCoverPhoto(imageUri);
      Toast.show({
        type: "success",
        text1: "Cover photo updated",
        text2: "Your business cover photo has been updated.",
      });
    } catch (caught) {
      const response = caught as ApiResponse<unknown>;
      if (response.success) return;

      if (response.code === "RATE_LIMIT_EXCEEDED") {
        const retryAfter = Number(response.errors?.retry_after ?? 0);
        Toast.show({
          type: "error",
          text1: "Cover photo update limit reached",
          text2:
            retryAfter > 0
              ? `You can update your cover photo again in ${formatRetryTime(retryAfter)}.`
              : response.message || "Please try again later.",
        });
        return;
      }

      if (handleSystemError(response)) return;
      Toast.show({
        type: "error",
        text1: "Unable to update cover photo",
        text2: response.message || "Something went wrong. Please try again.",
      });
    }
  }

  async function checkCoverAllowance() {
    const result = await refetch();
    if (result.error || !result.data) return null;
    return result.data.cover_photo_update;
  }

  // Cold-load and recoverable profile failures
  if (isLoading && !business) {
    return <MerchantProfileSkeleton />;
  }

  if (!business) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title="Unable to load business profile"
          description="We couldn't load your business information. Please try again."
          primaryActionTitle="Try Again"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const pendingChanges: { label: string; href: Href }[] = [];
  if (pendingRequest) {
    pendingChanges.push({
      label: "Business name",
      href: `/(merchant)/business-update-requests/${pendingRequest.id}` as Href,
    });
  }
  if (pendingClassificationRequest) {
    pendingChanges.push({
      label: "Classification",
      href: `/(merchant)/business-update-requests/classification/${pendingClassificationRequest.id}` as Href,
    });
  }
  if (pendingLocationRequest) {
    pendingChanges.push({
      label: "Location & landmarks",
      href: `/(merchant)/business-update-requests/location/${pendingLocationRequest.id}` as Href,
    });
  }

  const pendingCount = pendingChanges.length;
  const isCheckingRequests =
    isCheckingName || isCheckingClassification || isCheckingLocation;
  const hasRequestStatusError = Boolean(
    nameError || classificationError || locationError,
  );
  const isRetryingRequestStatus = Boolean(
    (nameError && isRefetchingName) ||
    (classificationError && isRefetchingClassification) ||
    (locationError && isRefetchingLocation),
  );
  const isRequestStatusIncomplete = isCheckingRequests || hasRequestStatusError;
  const clusterIcon = clusters.find(
    (cluster) => cluster.id === business.cluster.id,
  )?.icon;
  const hoursSummary = getBusinessHoursSummary(
    business.operating_hours.map((hours, index) => ({ ...hours, id: index })),
  );
  const hoursStatus =
    business.operating_hours.length === 0
      ? "Unavailable"
      : hoursSummary.isOpen
        ? "Open now"
        : "Closed now";

  function handlePendingChangesPress() {
    if (pendingCount === 1) {
      router.push(pendingChanges[0].href);
    } else if (pendingCount > 1) {
      router.push("/(merchant)/change-requests" as Href);
    }
  }

  function handleRetryRequestStatus() {
    if (nameError) void refetchRequests();
    if (classificationError) void refetchClassification();
    if (locationError) void refetchLocation();
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <ScrollView
          testID="merchant-profile-scroll"
          className="flex-1"
          contentContainerClassName="flex-grow"
          contentContainerStyle={{ paddingBottom: bottomSpacing }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover hero and live business identity */}
          <View
            testID="merchant-profile-hero-container"
            onLayout={(event) => {
              heroHeightRef.current = event.nativeEvent.layout.height;
            }}
          >
            {/* Cover hero and live business identity */}
            <MerchantProfileHeader
              businessName={business.business_name}
              classification={`${business.category.name} · ${business.cluster.name}`}
              clusterIcon={clusterIcon}
              status={business.status}
              coverPhotoUrl={business.display_cover_photo_url}
              avatarUrl={merchantAvatarUrl}
              avatarKey={merchantAvatarKey}
              isUploading={isUploading}
              coverPhotoUpdate={business.cover_photo_update}
              onCheckCoverAllowance={checkCoverAllowance}
              onEditCover={handleEditCover}
            />
          </View>

          <View className="bg-surface pb-4">
            {/* Primary actions */}
            <View
              testID="merchant-profile-actions"
              className="flex-row gap-2 px-5 pt-3"
            >
              <SafePressable
                onPress={handlePreview}
                accessibilityRole="button"
                className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center justify-center rounded-full  border border-border-primary bg-surface px-2 active:bg-background"
              >
                <MaterialCommunityIcons
                  name="eye-outline"
                  size={18}
                  color={theme.extends.colors.text.primary}
                />
                <AppText
                  weight="semibold"
                  className="ml-2 flex-shrink text-center text-xs text-text-primary"
                  numberOfLines={2}
                >
                  Preview as Explorer
                </AppText>
              </SafePressable>
              <SafePressable
                onPress={handleManageBusiness}
                accessibilityRole="button"
                className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center justify-center rounded-full bg-brand px-2 active:opacity-80"
              >
                <MaterialCommunityIcons
                  name="cog-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <AppText
                  weight="semibold"
                  className="ml-2 flex-shrink text-center text-xs text-white"
                  numberOfLines={2}
                >
                  Manage Business
                </AppText>
              </SafePressable>
            </View>

            {/* Centralized pending change status */}
            {pendingCount > 0 ? (
              <SafePressable
                onPress={handlePendingChangesPress}
                accessibilityRole="button"
                accessibilityLabel={
                  isRequestStatusIncomplete
                    ? `View confirmed ${pendingCount === 1 ? "change" : "changes"} under review`
                    : `View ${pendingCount} ${pendingCount === 1 ? "change" : "changes"} under review`
                }
                className="mt-6 min-h-[72px] cursor-pointer flex-row items-center gap-3 border-y border-border-primary bg-background px-5 py-3 active:bg-background"
              >
                {/* Pending status icon */}
                <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={23}
                    color="#3B82F6"
                  />
                </View>

                {/* Pending change summary */}
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <AppText
                      weight="semibold"
                      className="min-w-0 shrink text-sm text-text-primary"
                      numberOfLines={1}
                    >
                      Changes under review
                    </AppText>

                    {/* Pending request count */}
                    {!isRequestStatusIncomplete ? (
                      <View className="min-w-6 items-center justify-center rounded-full bg-blue-500/10 px-2 py-0.5">
                        <AppText
                          weight="bold"
                          className="text-xs text-blue-500"
                        >
                          {pendingCount}
                        </AppText>
                      </View>
                    ) : null}
                  </View>

                  {/* Affected business information */}
                  <AppText
                    className="mt-1 text-xs leading-5 text-text-secondary"
                    numberOfLines={2}
                  >
                    {pendingChanges.map((change) => change.label).join(" · ")}
                  </AppText>
                  {isCheckingRequests ? (
                    <AppText className="text-xs text-text-secondary">
                      Checking other request statuses...
                    </AppText>
                  ) : null}
                </View>

                {/* Navigation indicator */}
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.extends.colors.text.secondary}
                />
              </SafePressable>
            ) : null}

            {isCheckingRequests &&
            !hasRequestStatusError &&
            pendingCount === 0 ? (
              <View
                testID="merchant-request-status-skeleton"
                className="mt-6 gap-2 border-y border-border-primary bg-background px-5 py-4"
              >
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-3 w-56 max-w-full rounded-md" />
              </View>
            ) : null}

            {hasRequestStatusError ? (
              <View className="mt-4">
                <ErrorState
                  size="section"
                  title="Unable to check update requests"
                  description={
                    isRetryingRequestStatus
                      ? "Checking request statuses..."
                      : "Some request statuses couldn't be loaded."
                  }
                  primaryActionTitle={
                    isRetryingRequestStatus ? undefined : "Retry"
                  }
                  onPrimaryAction={
                    isRetryingRequestStatus
                      ? undefined
                      : handleRetryRequestStatus
                  }
                />
              </View>
            ) : null}

            {/* Snapshot metrics for the live business */}
            <View className="px-5 pt-6">
              <AppText weight="bold" className="text-md text-text-primary">
                Overview
              </AppText>

              <AppText className="mt-1 text-xs text-text-secondary">
                A quick snapshot of your business.
              </AppText>

              {/* Business overview cards */}
              <View className="mt-4 flex-row gap-2">
                {[
                  {
                    key: "photos",
                    Icon: PhotosCardIcon,
                    label: "Photos",
                    value: String(business.photos.length),
                  },
                  {
                    key: "landmarks",
                    Icon: LandmarksCardIcon,
                    label: "Landmarks",
                    value: String(business.location.landmarks.length),
                  },
                  {
                    key: "hours",
                    Icon: HoursCardIcon,
                    label: "Hours",
                    value: hoursStatus,
                  },
                ].map((item) => (
                  <View
                    key={item.key}
                    className="min-w-0 flex-1 rounded-xl border border-border-primary/70 bg-surface px-3 py-3"
                  >
                    {/* Illustrated metric icon */}
                    <View className="h-10 w-10 items-center justify-center">
                      <item.Icon width={40} height={40} />
                    </View>

                    {/* Metric label */}
                    <AppText
                      className="mt-3 text-xs text-text-secondary"
                      numberOfLines={1}
                    >
                      {item.label}
                    </AppText>

                    {/* Metric value */}
                    <AppText
                      weight="semibold"
                      className={`mt-0.5 text-sm ${
                        item.key === "hours" && hoursSummary.isOpen
                          ? "text-success"
                          : "text-text-primary"
                      }`}
                      numberOfLines={2}
                    >
                      {item.value}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Business introduction and specialties */}
          <MerchantBusinessStory
            business={business}
            onEditInformation={() =>
              router.push("/(merchant)/business-information")
            }
          />
          {/* Photos, hours, location, contact, verification, and mode switch */}
          <MerchantBusinessDetails
            business={business}
            onViewMap={() =>
              router.push("/(merchant)/business-location-map" as Href)
            }
            onViewDocument={(documentId) => void handleViewDocument(documentId)}
            openingDocumentId={
              documentAccess.isPending ? documentAccess.variables : null
            }
            onEditInformation={() =>
              router.push("/(merchant)/business-information")
            }
            onEditOperatingHours={() =>
              router.push("/(merchant)/operating-hours")
            }
            onManagePhotos={() => router.push("/(merchant)/business-photos")}
            onSwitchToExplorer={handleSwitchToExplorer}
            isSwitchingToExplorer={isSwitchingMode}
          />

          {/* Session action */}
          <View className=" mb-4 bg-surface">
            <ProfileMenuItem
              title="Logout"
              icon="logout"
              variant="danger"
              onPress={() => setShowLogoutModal(true)}
              showChevron={false}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Logout confirmation */}
      <ConfirmModal
        visible={showLogoutModal}
        title="Log out?"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        destructive
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={logout}
      />

      {/* Collapsed business identity on scroll */}
      <MerchantProfileStickyHeader
        businessName={business.business_name}
        classification={`${business.category.name} · ${business.cluster.name}`}
        coverPhotoUrl={business.display_cover_photo_url}
        clusterIcon={clusterIcon}
        visible={isStickyVisible}
        opacity={stickyOpacity}
        translateY={stickyTranslateY}
        onManageBusiness={handleManageBusiness}
      />
    </View>
  );
}
