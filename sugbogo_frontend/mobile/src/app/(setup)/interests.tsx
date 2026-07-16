import InterestFooter from "@/features/interest-selection/components/InterestFooter";
import InterestGrid from "@/features/interest-selection/components/InterestGrid";
import InterestHeader from "@/features/interest-selection/components/InterestHeader";
import SetupSkipButton from "@/features/interest-selection/components/SetupSkipButton";
import { completeInterestSelection } from "@/features/auth/api/user.service";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth/store/auth.store";
const MIN_SELECTION = 3;

export default function Interests() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handleCompleteSelection = async () => {
    try {
      await completeInterestSelection();

      if (user) {
        setUser({
          ...user,
          has_completed_interest_selection: true,
        });
      }

      router.replace("/(explorer)/(tabs)/explore");
    } catch (error) {
      console.error("Failed to complete interest selection:", error);
    }
  };

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const hasMinSelection = selected.length >= MIN_SELECTION;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-6 pt-6">
        <SetupSkipButton onPress={handleCompleteSelection} />
      </View>

      <View className="flex-1 px-6 pt-xl">
        <InterestHeader />

        <InterestGrid selected={selected} onToggle={handleToggle} />
      </View>

      <InterestFooter
        hasMinSelection={hasMinSelection}
        onPress={handleCompleteSelection}
      />
    </SafeAreaView>
  );
}
