import { Text, View, Button } from "react-native";
import { getProfile } from "@/features/profile/api/profile.service";
import { useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { useLogout } from "@/features/auth/hooks/useLogout";

export default function Profile() {
  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        try {
          const profile = await getProfile();
        } catch (error) {
          console.log("Profile request failed.");
        }
      };

      fetchProfile();
    }, []),
  );

  const { logout } = useLogout();

  const handleLogout = async () => {
    await logout();

    router.replace("/(auth)/login");
  };
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
}
