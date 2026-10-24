import { View } from "react-native";
import { theme } from "@/constants/theme";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import Avatar from "@/shared/components/Avatar";
import RoleBadge from "@/shared/components/RoleBadge";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { Feather } from "@expo/vector-icons";
import type { AvatarKey } from "@/shared/constants/avatars";
import type { ReactNode } from "react";
type ProfileHeaderProps = {
  firstname: string;
  lastname: string;
  email: string;
  avatarUrl?: string | null;
  avatarKey?: AvatarKey | null;
  role: "explorer" | "merchant";
  onEditProfile?: () => void;
  children?: ReactNode;
};

/**
 * ProfileHeader component displays the user's profile information including their avatar, full name, and email.
 */
export default function ProfileHeader({
  firstname,
  lastname,
  email,
  avatarUrl,
  avatarKey,
  onEditProfile,
  role,
  children,
}: ProfileHeaderProps) {
  return (
    <View className="relative rounded-md bg-surface p-5">
      <View className="absolute right-1 top-1 z-10 items-center">
        <NotificationBellButton />
      </View>

      <View className="items-center px-6">
        <Avatar imageUrl={avatarUrl} avatarKey={avatarKey} size={80} />

        <View className="mt-3 w-full items-center">
          <View className="max-w-full flex-row items-center justify-center gap-2">
            <AppText
              weight="bold"
              className="shrink text-center text-md text-text-primary"
            >
              {firstname} {lastname}
            </AppText>
            {onEditProfile && (
              <SafePressable
                onPress={onEditProfile}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                hitSlop={12}
                className="h-6 w-6 shrink-0 items-center justify-center rounded-full active:bg-background"
              >
                <Feather
                  name="edit"
                  size={16}
                  color={theme.extends.colors.text.secondary}
                  strokeWidth={2}
                />
              </SafePressable>
            )}
          </View>

          <AppText
            className="mt-1 text-center text-xs text-text-secondary"
          >
            {email}
          </AppText>

          <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
            <RoleBadge role="explorer" />
            {role === "merchant" && <RoleBadge role="merchant" />}
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}
