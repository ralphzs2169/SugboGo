import type { ReactNode } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Avatar from "@/shared/components/Avatar";
import SafePressable from "@/shared/components/SafePressable";
import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";

type Props = {
  children?: ReactNode;
};

/**
 * Pinned Community header with account access, notifications, and quick filters.
 *
 * Respects the device's top safe area. Controls are passed as children so the
 * feed owns filter behavior.
 */
export default function CommunityHeader({ children }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasSession = isAuthenticated && Boolean(user);

  return (
    <View
      className="border-b border-border-primary bg-surface"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Community introduction */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center justify-between gap-2">
          <AppText
            weight="superbold"
            className="min-w-0 flex-1 text-2xl text-text-primary"
          >
            Community
          </AppText>
          {/* Match the Explore header action order and touch targets. */}
          <View className="flex-row items-center">
            <NotificationBellButton />
            <SafePressable
              accessibilityRole="button"
              accessibilityLabel={hasSession ? "Open your profile" : "Sign in"}
              onPress={() =>
                router.navigate(
                  hasSession ? "/(explorer)/(tabs)/profile" : "/(auth)/login",
                )
              }
              className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:opacity-75"
            >
              {hasSession ? (
                <Avatar
                  imageUrl={user?.avatar_url}
                  avatarKey={user?.avatar_key}
                  size={36}
                />
              ) : (
                <MaterialCommunityIcons
                  name="account-circle-outline"
                  size={36}
                  color={theme.extends.colors.text.secondary}
                />
              )}
            </SafePressable>
          </View>
        </View>
        <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
          Experiences from Cebu explorers.
        </AppText>
      </View>

      {children}
    </View>
  );
}
