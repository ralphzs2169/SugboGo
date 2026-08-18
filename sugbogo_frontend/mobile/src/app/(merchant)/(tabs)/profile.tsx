import { Text, View } from "react-native";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { router } from "expo-router";
import ProfileMenuItem from "@/features/profile/components/ProfileMenuItem";
import ProfileMenuSection from "@/features/profile/components/ProfileMenuSection";

export default function MerchantProfilePage() {
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  const handleSwitchToExplorer = () => {
    setActiveMode("explorer");
    router.replace("/(explorer)/(tabs)/explore");
  };

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-xl font-semibold">Merchant Profile Page</Text>
      <ProfileMenuSection>
        <ProfileMenuItem
          title="Switch to Explorer"
          icon="compass-outline"
          onPress={handleSwitchToExplorer}
        />
      </ProfileMenuSection>
    </View>
  );
}
