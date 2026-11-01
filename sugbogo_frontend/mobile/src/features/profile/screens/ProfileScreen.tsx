import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useLogoutConfirmationStore } from "@/features/auth/store/logoutConfirmation.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import ErrorState from "@/shared/components/ErrorState";
import useNavigationAction from "@/shared/hooks/useNavigationAction";
import Skeleton from "@/shared/components/Skeleton";

import AppVersion from "../components/AppVersion";
import MerchantPortalCard from "../components/MerchantPortalCard";
import ProfileHeader from "../components/ProfileHeader";
import ProfileActivitySummary from "../components/ProfileActivitySummary";
import ProfileMenuItem from "../components/ProfileMenuItem";
import ProfileMenuSection from "../components/ProfileMenuSection";
import ProfileScrollView from "../components/ProfileScrollView";
import useApplicationStatus from "../hooks/useApplicationStatus";
import Toast from "react-native-toast-message";

/**
 * Displays the explorer profile, activity, account controls, and merchant access.
 *
 * Provides lightweight transition feedback while switching app modes and
 * exposes merchant onboarding status when merchant access is not yet active.
 */
export default function ProfileScreen() {
  const navigate = useNavigationAction();
  const user = useAuthStore((state) => state.user);

  const canAccessMerchantMode = user?.role === "merchant";

  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const openLogoutConfirmation = useLogoutConfirmationStore(
    (state) => state.open,
  );

  const {
    status: applicationStatus,
    merchantModeAcknowledged,
    isLoading: isLoadingApplicationStatus,
    error: applicationStatusError,
    hasResolvedStatus,
    refetch: refetchApplicationStatus,
  } = useApplicationStatus();
  const isInitialStatusLoading =
    isLoadingApplicationStatus && !hasResolvedStatus;

  useFocusEffect(
    useCallback(() => {
      void refetchApplicationStatus();
    }, [refetchApplicationStatus]),
  );

  const handleMerchantPortalPress = () => {
    navigate(() => router.push("/profile/merchant-portal"));
  };

  const handleSwitchToMerchant = () => {
    if (isSwitchingMode) {
      return;
    }

    navigate(() => {
      setIsSwitchingMode(true);

      setActiveMode("merchant");
      router.replace("/(merchant)/(tabs)/dashboard");

      Toast.show({
        type: "info",
        text1: "Switched to Merchant Mode",
      });
    });
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <View className="flex-1">
        <ProfileScrollView
          firstname={user?.first_name ?? ""}
          lastname={user?.last_name ?? ""}
        >
          {/* Profile identity */}
          <ProfileHeader
            firstname={user?.first_name ?? ""}
            lastname={user?.last_name ?? ""}
            email={user?.email ?? ""}
            avatarUrl={user?.avatar_url ?? null}
            avatarKey={user?.avatar_key ?? null}
            role={user?.role ?? "explorer"}
            onEditProfile={() =>
              navigate(() => router.push("/profile/edit-profile"))
            }
          >
            <ProfileActivitySummary className="mt-2" />
          </ProfileHeader>

          {/* Explorer activity */}
          <ProfileMenuSection title="Your exploration">
            <ProfileMenuItem
              title="My Pockets"
              icon="bookmark-outline"
              onPress={() => navigate(() => router.push("/profile/my-pockets"))}
            />
            <ProfileMenuItem
              title="My Vouches"
              icon="heart-outline"
              onPress={() =>
                navigate(() => router.push("/profile/vouch-history"))
              }
            />
            <ProfileMenuItem
              title="My Reviews"
              icon="comment-text-outline"
              onPress={() =>
                navigate(() => router.push("/profile/reviews-submitted"))
              }
            />
            <ProfileMenuItem
              title="Activity Timeline"
              icon="history"
              onPress={() =>
                navigate(() => router.push("/profile/activity-timeline"))
              }
            />
            <ProfileMenuItem
              title="My Interests"
              icon="tune-variant"
              onPress={() =>
                navigate(() => router.push("/profile/your-interests"))
              }
            />
          </ProfileMenuSection>

          {/* Reserve merchant access while its initial status is unknown. */}
          {isInitialStatusLoading && (
            <View
              accessible
              accessibilityLabel="Loading merchant access"
              accessibilityState={{ busy: true }}
              className={`mx-4 mb-1.5 mt-3 flex-row items-center gap-3 rounded-card bg-surface p-4 ${
                canAccessMerchantMode ? "min-h-24" : "min-h-36"
              }`}
            >
              <Skeleton
                className={
                  canAccessMerchantMode
                    ? "h-12 w-12 rounded-full"
                    : "h-24 w-24 rounded-xl"
                }
              />
              <View className="flex-1 gap-3">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </View>
            </View>
          )}

          {/* Merchant mode */}
          {!isInitialStatusLoading &&
            canAccessMerchantMode &&
            merchantModeAcknowledged && (
              <ProfileMenuSection title="Merchant">
                <ProfileMenuItem
                  title={
                    isSwitchingMode
                      ? "Switching to Merchant..."
                      : "Switch to Merchant"
                  }
                  icon="storefront-outline"
                  onPress={handleSwitchToMerchant}
                  disabled={isSwitchingMode}
                  isLoading={isSwitchingMode}
                />
              </ProfileMenuSection>
            )}

          {/* Merchant onboarding */}
          {!isInitialStatusLoading &&
            applicationStatusError &&
            hasResolvedStatus &&
            applicationStatus === null && (
              <ErrorState
                size="section"
                title="Unable to refresh merchant status"
                description="Showing your last available merchant status."
                primaryActionTitle="Try Again"
                onPrimaryAction={() => {
                  void refetchApplicationStatus();
                }}
              />
            )}

          {!isInitialStatusLoading &&
            !merchantModeAcknowledged &&
            (applicationStatusError && !hasResolvedStatus ? (
              <ErrorState
                size="section"
                title="Unable to load merchant status"
                description="We couldn't check your merchant application."
                primaryActionTitle="Try Again"
                onPrimaryAction={() => {
                  void refetchApplicationStatus();
                }}
              />
            ) : (
              <MerchantPortalCard
                status={applicationStatus}
                onPress={handleMerchantPortalPress}
              />
            ))}

          {/* Settings and support */}
          <ProfileMenuSection title="Settings & Support">
            <ProfileMenuItem
              title="Account Settings"
              icon="account-cog-outline"
              onPress={() =>
                navigate(() => router.push("/profile/account-settings"))
              }
            />

            <ProfileMenuItem
              title="Offline Storage"
              icon="database-outline"
              onPress={() => navigate(() => router.push("/offline-storage"))}
            />

            <ProfileMenuItem
              title="Privacy Policy"
              icon="shield-lock-outline"
              onPress={() => navigate(() => router.push("/privacy-policy"))}
            />

            <ProfileMenuItem
              title="Contact Support"
              icon="headset"
              onPress={() => navigate(() => router.push("/contact-support"))}
            />
          </ProfileMenuSection>

          {/* Session action */}
          <ProfileMenuSection>
            <ProfileMenuItem
              title="Logout"
              icon="logout"
              variant="danger"
              onPress={openLogoutConfirmation}
              showChevron={false}
            />
          </ProfileMenuSection>

          <AppVersion />
        </ProfileScrollView>
      </View>
    </SafeAreaView>
  );
}
