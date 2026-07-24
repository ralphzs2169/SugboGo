import { Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProfileHeader from "../components/ProfileHeader";
import ProfileMenuItem from "../components/ProfileMenuItem";
import MerchantCard from "../components/MerchantCard";
import ProfileMenuSection from "../components/ProfileMenuSection";
import { useLogout } from "@/features/auth/hooks/useLogout";
import AppVersion from "../components/AppVersion";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { router } from "expo-router";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import ProfileScrollView from "../components/ProfileScrollView";
import { useState } from "react";

/**
 * ProfileScreen component.
 *
 * Displays the user's profile information, activity, and settings.
 */
export default function ProfileScreen({}) {
  const user = useAuthStore((state) => state.user);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { logout } = useLogout();

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

          <MerchantCard onPress={() => {}} />

          {/* Menu Sections */}
          <ProfileMenuSection title="Your Activity">
            <ProfileMenuItem
              title="My Pockets"
              icon="wallet-outline"
              badge={3}
              onPress={() => {}}
            />

            <ProfileMenuItem
              title="Vouch History"
              icon="heart-outline"
              onPress={() => {}}
            />

            <ProfileMenuItem
              title="My Reviews"
              icon="comment-outline"
              onPress={() => {}}
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
