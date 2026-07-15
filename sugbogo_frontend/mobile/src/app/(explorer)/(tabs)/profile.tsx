import { Text, View } from "react-native";
import { getProfile } from "@/features/profile/api/profile.service";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function Profile() {
  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          const profile = await getProfile();
          console.log(profile);
        } catch (error) {
          console.log("Profile request failed.");
        }
      };

      fetchProfile();
    }, []),
  );

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Profile</Text>
    </View>
  );
}
