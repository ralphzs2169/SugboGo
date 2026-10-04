import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import AppText from "@/shared/components/AppText";
import { theme } from "@/constants/theme";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import MerchantBusinessOverview from "../../components/business-profile/MerchantBusinessOverview";
import MerchantProfileHeader from "../../components/business-profile/MerchantProfileHeader";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantBusinessNameChangeRequests } from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import { useMerchantClassificationChangeRequests } from "../../hooks/classification-change/useMerchantClassificationChanges";
import { useMerchantLocationChangeRequests } from "../../hooks/location-change/useMerchantLocationChanges";
import useUpdateBusinessCoverPhoto from "../../hooks/business-profile/useUpdateBusinessCoverPhoto";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { formatRetryTime } from "@/shared/utils/date.utils";

/**
 * Displays the live business listing with compact management entry points.
 *
 * Pulling down refreshes the latest business profile data, including
 * the current server-provided cover-photo allowance.
 */
export default function MerchantProfileScreen() {
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);
  const bottomSpacing = useTabBarSpacing();

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();
  const { pendingRequest, refetch: refetchRequests } =
    useMerchantBusinessNameChangeRequests();
  const {
    pendingRequest: pendingClassificationRequest,
    isLoading: isCheckingClassification,
    error: classificationError,
    refetch: refetchClassification,
  } = useMerchantClassificationChangeRequests();
  const {
    pendingRequest: pendingLocationRequest,
    isLoading: isCheckingLocation,
    error: locationError,
    refetch: refetchLocation,
  } = useMerchantLocationChangeRequests();

  useQueryErrorNotification({
    error,
    toastId: "merchant-business-profile-error",
    title: "Unable to load business profile",
    fallbackMessage: "Please try again.",
  });

  const { updateCoverPhoto, isUploading } = useUpdateBusinessCoverPhoto(
    business?.id,
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
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
  };

  const handleSwitchToExplorer = () => {
    setActiveMode("explorer");
    router.replace("/(explorer)/(tabs)/explore");
  };

  const handlePreview = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: String(business!.id), previewAsExplorer: "1" },
    });
  };

  const handleEditCover = async (imageUri: string) => {
    try {
      await updateCoverPhoto(imageUri);

      Toast.show({
        type: "success",
        text1: "Cover photo updated",
        text2: "Your business cover photo has been updated.",
      });
    } catch (error) {
      const response = error as ApiResponse<unknown>;

      if (!response.success) {
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

        if (handleSystemError(response)) {
          return;
        }

        Toast.show({
          type: "error",
          text1: "Unable to update cover photo",
          text2: response.message || "Something went wrong. Please try again.",
        });
      }
    }
  };

  const checkCoverAllowance = async () => {
    const result = await refetch();

    if (result.error || !result.data) {
      return null;
    }

    return result.data.cover_photo_update;
  };

  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Business Profile"
        description="Fetching your business information..."
      />
    );
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

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Business profile */}
        <MerchantProfileHeader
          businessName={business.business_name}
          classification={`${business.category.name} · ${business.cluster.name}`}
          status={business.status}
          coverPhotoUrl={business.cover_photo_url}
          isUploading={isUploading}
          coverPhotoUpdate={business.cover_photo_update}
          onCheckCoverAllowance={checkCoverAllowance}
          onEditCover={handleEditCover}
        />

        {/* Primary profile actions */}
        <View
          testID="merchant-profile-actions"
          className="mb-2 flex-row gap-2 bg-surface px-5 py-3"
        >
          <Pressable
            onPress={handlePreview}
            accessibilityRole="button"
            className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary px-2 active:bg-background"
          >
            <MaterialCommunityIcons
              name="eye-outline"
              size={17}
              color={theme.extends.colors.text.primary}
            />
            <AppText
              weight="semibold"
              className="ml-1.5 flex-shrink text-center text-xs text-text-primary"
              numberOfLines={2}
            >
              Preview as Explorer
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(merchant)/manage-business" as Href)}
            accessibilityRole="button"
            className="min-h-12 min-w-0 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl bg-brand px-2 active:opacity-80"
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={17}
              color="#FFFFFF"
            />
            <AppText
              weight="semibold"
              className="ml-1.5 flex-shrink text-center text-xs text-white"
              numberOfLines={2}
            >
              Manage Business
            </AppText>
          </Pressable>
        </View>

        {/* Compact reviewed-change summary */}
        {pendingCount > 0 ? (
          <Pressable
            onPress={() =>
              router.push(
                pendingCount === 1
                  ? pendingChanges[0].href
                  : ("/(merchant)/change-requests" as Href),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={
              pendingCount === 1
                ? `View pending ${pendingChanges[0].label} request`
                : `View ${pendingCount} pending changes`
            }
            className="mb-2 min-h-16 cursor-pointer flex-row items-center bg-surface px-5 py-3 active:bg-background"
          >
            <View className="flex-1">
              <AppText weight="bold" className="text-sm text-text-primary">
                {pendingCount === 1
                  ? "Pending change"
                  : `${pendingCount} pending changes`}
              </AppText>
              {pendingCount === 1 ? (
                <AppText
                  weight="semibold"
                  className="mt-0.5 text-sm text-text-primary"
                >
                  {pendingChanges[0].label}
                </AppText>
              ) : null}
              <AppText className="mt-0.5 text-xs text-text-secondary">
                Awaiting Admin review
              </AppText>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        ) : null}
        <MerchantBusinessOverview
          business={business}
          pendingClassificationRequest={pendingClassificationRequest}
          isCheckingClassification={isCheckingClassification}
          hasClassificationError={Boolean(classificationError)}
          onClassificationHistory={() =>
            router.push(
              pendingClassificationRequest
                ? (`/(merchant)/business-update-requests/classification/${pendingClassificationRequest.id}` as Href)
                : ("/(merchant)/business-update-requests/classification" as Href),
            )
          }
          onRetryClassification={() => void refetchClassification()}
          pendingLocationRequest={pendingLocationRequest}
          isCheckingLocation={isCheckingLocation}
          hasLocationError={Boolean(locationError)}
          onLocationHistory={() =>
            router.push(
              pendingLocationRequest
                ? (`/(merchant)/business-update-requests/location/${pendingLocationRequest.id}` as Href)
                : ("/(merchant)/business-update-requests/location" as Href),
            )
          }
          onRetryLocation={() => void refetchLocation()}
          onEditInformation={() =>
            router.push("/(merchant)/business-information")
          }
          onEditOperatingHours={() =>
            router.push("/(merchant)/operating-hours")
          }
          onManagePhotos={() => router.push("/(merchant)/business-photos")}
          onSwitchToExplorer={handleSwitchToExplorer}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
