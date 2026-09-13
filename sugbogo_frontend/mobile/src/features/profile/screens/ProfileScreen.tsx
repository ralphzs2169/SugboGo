import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";

import AppVersion from "../components/AppVersion";
import MerchantPortalCard from "../components/MerchantPortalCard";
import ProfileHeader from "../components/ProfileHeader";
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
  const user = useAuthStore((state) => state.user);

  const canAccessMerchantMode = user?.role === "merchant";

  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  const { logout } = useLogout();

  const {
    status: applicationStatus,
    merchantModeAcknowledged,
    isLoading: isLoadingApplicationStatus,
    refetch: refetchApplicationStatus,
  } = useApplicationStatus();

  useFocusEffect(
    useCallback(() => {
      void refetchApplicationStatus();
    }, [refetchApplicationStatus]),
  );

  const handleMerchantPortalPress = () => {
    router.push("/profile/merchant-portal");
  };

  const handleSwitchToMerchant = () => {
    if (isSwitchingMode) {
      return;
    }

    setIsSwitchingMode(true);

    setActiveMode("merchant");
    router.replace("/(merchant)/(tabs)/dashboard");

    Toast.show({
      type: "info",
      text1: "Switched to Merchant Mode",
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
            onEditProfile={() => router.push("/profile/edit-profile")}
          />

          {/* Merchant mode */}
          {!isLoadingApplicationStatus &&
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

          {/* Explorer activity */}
          <ProfileMenuSection title="Your Activity">
            <ProfileMenuItem
              title="My Pockets"
              icon="wallet-outline"
              badge={5}
              onPress={() => router.push("/profile/my-pockets")}
            />

            <ProfileMenuItem
              title="Vouch History"
              icon="heart-outline"
              onPress={() => router.push("/profile/vouch-history")}
            />

            <ProfileMenuItem
              title="My Reviews"
              icon="comment-outline"
              onPress={() => router.push("/profile/reviews-submitted")}
            />

            <ProfileMenuItem
              title="Activity Timeline"
              icon="history"
              onPress={() => {}}
            />

            <ProfileMenuItem
              title="My Impact"
              icon="hand-heart-outline"
              onPress={() => {}}
            />

            <ProfileMenuItem
              title="Your Interests"
              icon="tune-variant"
              onPress={() => router.push("/profile/your-interests")}
            />
          </ProfileMenuSection>

          {/* Merchant onboarding */}
          {!isLoadingApplicationStatus && !merchantModeAcknowledged && (
            <MerchantPortalCard
              status={applicationStatus}
              onPress={handleMerchantPortalPress}
            />
          )}

          {/* Settings and support */}
          <ProfileMenuSection title="Settings & Support">
            <ProfileMenuItem
              title="Account Settings"
              icon="account-cog-outline"
              onPress={() => router.push("/profile/account-settings")}
            />

            <ProfileMenuItem
              title="Language"
              icon="translate"
              onPress={() => {}}
            />

            <ProfileMenuItem
              title="Offline Data"
              icon="database-outline"
              onPress={() => {}}
            />

            <ProfileMenuItem title="Sync Now" icon="sync" onPress={() => {}} />
          </ProfileMenuSection>

          {/* Session action */}
          <ProfileMenuSection>
            <ProfileMenuItem
              title="Logout"
              icon="logout"
              variant="danger"
              onPress={() => setShowLogoutModal(true)}
              showChevron={false}
            />
          </ProfileMenuSection>

          <AppVersion />
        </ProfileScrollView>

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
      </View>
    </SafeAreaView>
  );
}
