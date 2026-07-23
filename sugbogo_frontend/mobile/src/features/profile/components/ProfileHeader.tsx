import { Image, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type ProfileHeaderProps = {
  firstname: string;
  lastname: string;
  email: string;
  avatarUrl?: string | null;
  onEditProfile?: () => void;
};

/**
 * ProfileHeader component displays the user's profile information including their avatar, full name, and email.
 * @param {fullName} fullName - The full name of the user.
 * @param {email} email - The email address of the user.
 * @param {avatarUrl} avatarUrl - Optional URL for the user's avatar image.
 * @returns {JSX.Element} The rendered ProfileHeader component.
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
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="h-20 w-20 rounded-full"
          resizeMode="cover"
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-full bg-background">
          <MaterialCommunityIcons name="account" size={42} color="#999999" />
        </View>
      )}

      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <Text
            className="flex-1 text-xl font-semibold text-text-primary"
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
                color={theme.colors.brand}
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
