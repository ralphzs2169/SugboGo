import { type Href, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/features/auth/store/auth.store";
import AppText from "@/shared/components/AppText";
import ProfileMenuItem from "../components/ProfileMenuItem";
import ProfileMenuSection from "../components/ProfileMenuSection";

/** Provides account identity and the available password-management action. */
export default function AccountSettingsScreen() {
  const user = useAuthStore((state) => state.user);
  const needsPasswordSetup = user?.has_usable_password === false;

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-surface"
    >
      <ScrollView
        contentContainerClassName="p-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Signed-in account identity */}
        <View className="mb-5">
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
            title={needsPasswordSetup ? "Set up a password" : "Change password"}
            icon="lock-outline"
            onPress={() => router.push("/profile/change-password" as Href)}
          />
        </ProfileMenuSection>
        <AppText className="mt-3 px-1 text-sm leading-5 text-text-secondary">
          {needsPasswordSetup
            ? "You sign in with a linked account. Use email recovery to create a password."
            : "Keep your account secure with a password you don't use elsewhere."}
        </AppText>

        {/* Account access and retention */}
        <View className="mt-6">
          <ProfileMenuSection title="Account access">
            <ProfileMenuItem
              title="Deactivate account"
              icon="account-cancel-outline"
              variant="danger"
              onPress={() => router.push("/profile/deactivate-account" as Href)}
            />
          </ProfileMenuSection>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
