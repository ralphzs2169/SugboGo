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
      <View className="mb-2 flex-row items-center justify-end">
        <NotificationBellButton />
        {onEditProfile && (
          <SafePressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            className="h-12 w-12 items-center justify-center rounded-full active:bg-background"
          >
            <Feather
              name="edit"
              size={20}
              color={theme.extends.colors.text.secondary}
              strokeWidth={2}
            />
          </SafePressable>
        )}
      </View>

      <View className="items-center px-6">
        <Avatar imageUrl={avatarUrl} avatarKey={avatarKey} size={80} />

        <View className="mt-3 w-full items-center">
          <AppText
            weight="bold"
            className="text-center text-md text-text-primary"
          >
            {firstname} {lastname}
          </AppText>

          <AppText
            className="mt-1 text-center text-xs text-text-secondary"
          >
            {email}
          </AppText>

          <View className="items-center">
            <RoleBadge role={role} />
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}
