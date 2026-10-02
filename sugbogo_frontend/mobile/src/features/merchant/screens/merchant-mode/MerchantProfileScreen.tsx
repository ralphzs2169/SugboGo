import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import ProfileMenuItem from "@/features/profile/components/ProfileMenuItem";
import ProfileMenuSection from "@/features/profile/components/ProfileMenuSection";

import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import AppText from "@/shared/components/AppText";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import MerchantBusinessOverview from "../../components/business-profile/MerchantBusinessOverview";
import MerchantProfileHeader from "../../components/business-profile/MerchantProfileHeader";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateBusinessCoverPhoto from "../../hooks/business-profile/useUpdateBusinessCoverPhoto";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { ApiResponse } from "@/shared/types/apiResponse.types";
import { formatRetryTime } from "@/shared/utils/date.utils";

/**
 * Displays the authenticated merchant's approved business and retained
 * verification details alongside the existing cover-photo control.
 *
 * Pulling down refreshes the latest business profile data, including
 * the current server-provided cover-photo allowance.
 */
export default function MerchantProfileScreen() {
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);
  const bottomSpacing = useTabBarSpacing();

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();

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
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchToExplorer = () => {
    setActiveMode("explorer");
    router.replace("/(explorer)/(tabs)/explore");
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
          coverPhotoUrl={business.cover_photo_url}
          isUploading={isUploading}
          coverPhotoUpdate={business.cover_photo_update}
          onCheckCoverAllowance={checkCoverAllowance}
          onEditCover={handleEditCover}
        />

        {/* Current approved listing */}
        <View className="mb-2 bg-surface px-5 pb-4">
          <AppText weight="bold" className="mb-2 text-lg text-text-primary">
            My Business
          </AppText>
          <View
            className={`self-start rounded-full px-3 py-1 ${
              business.status === "active" ? "bg-success/10" : "bg-error/10"
            }`}
          >
            <AppText
              weight="semibold"
              className={`text-xs ${
                business.status === "active" ? "text-success" : "text-error"
              }`}
            >
              {business.status === "active" ? "Active" : "Suspended"}
            </AppText>
          </View>
        </View>
        <MerchantBusinessOverview
          business={business}
          onEditInformation={() =>
            router.push("/(merchant)/business-information")
          }
          onEditOperatingHours={() =>
            router.push("/(merchant)/operating-hours")
          }
          onManagePhotos={() => router.push("/(merchant)/business-photos")}
        />

        {/* Merchant actions */}
        <ProfileMenuSection>
          <ProfileMenuItem
            title="Switch to Explorer"
            icon="compass-outline"
            onPress={handleSwitchToExplorer}
          />
        </ProfileMenuSection>
      </ScrollView>
    </SafeAreaView>
  );
}
