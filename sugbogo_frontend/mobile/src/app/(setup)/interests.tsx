import InterestFooter from "@/features/interest-selection/components/InterestFooter";
import InterestGrid from "@/features/interest-selection/components/InterestGrid";
import InterestHeader from "@/features/interest-selection/components/InterestHeader";
import SetupSkipButton from "@/features/interest-selection/components/SetupSkipButton";

import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { Button } from "react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
const MIN_SELECTION = 3;

export default function Interests() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleContinue = () => {
    router.push("/(explorer)/(tabs)/explore");
  };
  const { logout } = useLogout();
  const handleLogout = async () => {
    await logout();

    console.log(useAuthStore.getState());

    router.replace("/(auth)/login");
  };
  const hasMinSelection = selected.length >= MIN_SELECTION;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <SetupSkipButton onPress={handleContinue} />
        <Button title="Logout" onPress={handleLogout} />
      </View>

      <View className="flex-1 px-6 pt-xl">
        <InterestHeader />

        <InterestGrid selected={selected} onToggle={handleToggle} />
      </View>

      <InterestFooter
        hasMinSelection={hasMinSelection}
        onPress={handleContinue}
      />
    </SafeAreaView>
  );
}
