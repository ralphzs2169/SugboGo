import { Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import Avatar from "@/shared/components/Avatar";

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
    <View className="flex-row items-center rounded-md bg-surface p-5">
      {/* Avatar Container */}
      <Avatar imageUrl={avatarUrl} size={80} />

      {/* User Information */}
      <View className="ml-6 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="flex-1 text-md font-bold text-text-primary"
            numberOfLines={1}
          >
            {firstname} {lastname}
          </Text>

          {onEditProfile && (
            <TouchableOpacity
              onPress={onEditProfile}
              className="ml-3 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={16}
                color={theme.extends.colors.brand}
              />

              <Text className="ml-1 text-sm font-medium text-brand">Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="mt-1 text-sm text-text-secondary" numberOfLines={1}>
          {email}
        </Text>
      </View>
    </View>
  );
}
