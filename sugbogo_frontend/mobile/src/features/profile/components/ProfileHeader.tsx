import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";
import RoleBadge from "@/shared/components/RoleBadge";

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
          className="absolute right-4 top-4 flex-row items-center rounded-full bg-gray-100 px-3 py-1.5"
        >
          <Text className="ml-1 text-xs font-semibold tracking-wide  text-text-primary">
            Edit
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-row items-center">
        <Avatar imageUrl={avatarUrl} size={80} />

        <View className="ml-6 flex-1 pr-12">
          <Text
            className="text-md font-bold text-text-primary"
            numberOfLines={1}
          >
            {firstname} {lastname}
          </Text>

          <Text className="mt-1 text-sm text-text-secondary" numberOfLines={1}>
            {email}
          </Text>

          <RoleBadge role="explorer" />
        </View>
      </View>
    </View>
  );
}
