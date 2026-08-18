import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProfileHeader from "../components/ProfileHeader";
import ProfileMenuItem from "../components/ProfileMenuItem";
import MerchantPortalCard from "../components/MerchantPortalCard";
import ProfileMenuSection from "../components/ProfileMenuSection";
import { useLogout } from "@/features/auth/hooks/useLogout";
import AppVersion from "../components/AppVersion";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { router } from "expo-router";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import ProfileScrollView from "../components/ProfileScrollView";
import { useState } from "react";
import useApplicationStatus from "../hooks/useApplicationStatus";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";

/**
 * ProfileScreen component.
 *
 * Displays the user's profile information, activity, and settings.
 */
export default function ProfileScreen({}) {
  const user = useAuthStore((state) => state.user);

  const canAccessMerchantMode = user?.role === "merchant";
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { logout } = useLogout();

  const {
    status: applicationStatus,
    isLoading: isLoadingApplicationStatus,
    error: applicationStatusError,
    refetch: refetchApplicationStatus,
  } = useApplicationStatus();

  const handleMerchantPortalPress = () => {
    router.push("/profile/merchant-portal");
  };

  const handleSwitchToMerchant = () => {
    setActiveMode("merchant");
    router.replace("/(merchant)/(tabs)/dashboard");
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
          <ProfileHeader
            firstname={user?.first_name ?? ""}
            lastname={user?.last_name ?? ""}
            email={user?.email ?? ""}
            avatarUrl={user?.avatar_url ?? null}
            onEditProfile={() => router.push("/profile/edit-profile")}
          />

          {/* Menu Sections */}
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
              title="My Preferences"
              icon="tune-variant"
              onPress={() => {}}
            />
          </ProfileMenuSection>

          <MerchantPortalCard
            status={applicationStatus}
            onPress={handleMerchantPortalPress}
          />

          {canAccessMerchantMode && (
            <ProfileMenuSection>
              <ProfileMenuItem
                title="Switch to Merchant"
                icon="storefront-outline"
                onPress={handleSwitchToMerchant}
              />
            </ProfileMenuSection>
          )}

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

          <ProfileMenuSection>
            <ProfileMenuItem
              title="Logout"
              icon="logout"
              variant="danger"
              onPress={() => setShowLogoutModal(true)}
              showChevron={false}
            />
          </ProfileMenuSection>
          <ConfirmModal
            visible={showLogoutModal}
            title="Log out?"
            message="Are you sure you want to log out of your account?"
            confirmText="Logout"
            destructive
            onCancel={() => setShowLogoutModal(false)}
            onConfirm={logout}
          />
          <AppVersion />
        </ProfileScrollView>
      </View>
    </SafeAreaView>
  );
}
