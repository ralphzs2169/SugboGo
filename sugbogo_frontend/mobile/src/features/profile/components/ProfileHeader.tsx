import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";
import RoleBadge from "@/shared/components/RoleBadge";
import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
type ProfileHeaderProps = {
  firstname: string;
  lastname: string;
  email: string;
  avatarUrl?: string | null;
  onEditProfile?: () => void;
};

/**
 * ProfileHeader component displays the user's profile information including their avatar, full name, and email.
 */
export default function ProfileHeader({
  firstname,
  lastname,
  email,
  avatarUrl,
  onEditProfile,
}: ProfileHeaderProps) {
  return (
    <View className="relative rounded-md bg-surface p-5">
      {onEditProfile && (
        <TouchableOpacity
          onPress={onEditProfile}
          className="absolute right-4 top-4 flex-row items-center rounded-md"
        >
          <Feather
            name="edit"
            size={20}
            color={theme.extends.colors.text.secondary}
            strokeWidth={2}
          />
        </TouchableOpacity>
      )}

      <View className="flex-row items-center">
        <Avatar imageUrl={avatarUrl} size={100} />

        <View className="ml-3 flex-1 pr-12">
          <Text
            className="text-md font-bold text-text-primary truncate"
            numberOfLines={1}
          >
            {firstname} {lastname}
          </Text>

          <Text className="mt-1 text-xs text-text-secondary" numberOfLines={1}>
            {email}
          </Text>

          <RoleBadge role="explorer" />
        </View>
      </View>
    </View>
  );
}
