import { type Href, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/features/auth/store/auth.store";
import AppText from "@/shared/components/AppText";
import ProfileMenuItem from "../components/ProfileMenuItem";
import ProfileMenuSection from "../components/ProfileMenuSection";

/** Provides account identity, credential management, and deactivation actions. */
export default function AccountSettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const needsPasswordSetup = user?.has_usable_password === false;

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Signed-in account identity */}
        <View className="bg-surface px-5 py-5">
          <AppText weight="semibold" className="text-sm text-text-secondary">
            Signed in as
          </AppText>
          <AppText className="mt-1 text-base text-text-primary">
            {user?.email}
          </AppText>
        </View>

        {/* Password management */}
        <ProfileMenuSection title="Security">
          <ProfileMenuItem
            title="Login History"
            icon="history"
            onPress={() => router.push("/profile/login-history" as Href)}
          />
          <ProfileMenuItem
            title="Change Email"
            icon="email-outline"
            onPress={() => router.push("/profile/change-email" as Href)}
          />
          <ProfileMenuItem
            title={needsPasswordSetup ? "Set Up a Password" : "Change Password"}
            icon="lock-outline"
            onPress={() => router.push("/profile/change-password" as Href)}
          />
          {needsPasswordSetup && (
            <AppText className="px-5 pb-2 text-sm leading-5 text-text-secondary">
              You sign in with a linked account. Use email recovery to create a
              password.
            </AppText>
          )}
        </ProfileMenuSection>

        {/* Account access and retention */}
        <ProfileMenuSection title="Account Access">
          <ProfileMenuItem
            title="Deactivate Account"
            icon="account-cancel-outline"
            variant="danger"
            onPress={() => router.push("/profile/deactivate-account" as Href)}
          />
        </ProfileMenuSection>
      </ScrollView>
    </SafeAreaView>
  );
}
