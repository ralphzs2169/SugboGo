import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InterestGrid from "../../components/interests/InterestGrid";

const MIN_SELECTION = 3;

export default function Interests() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const hasMinSelection = selected.length >= MIN_SELECTION;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Top Bar */}
      <View
        className="flex-row items-center justify-between bg-surface px-6 pt-6 pb-4"
        style={{ elevation: 2 }} // shadow-sm equivalent (Android)
      >
        <Text className="text-h2 font-bold">
          <Text className="text-brand">Sugbo</Text>
          <Text className="text-dark">Go</Text>
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/(explorer)/(tabs)/explore")}
        >
          <Text className="text-body font-semibold tracking-widest text-placeholder">
            SKIP FOR NOW
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-xl ">
        <Text className="mb-3 text-center text-h1 font-bold leading-tight text-dark">
          What <Text className="text-h1 text-brand">interests</Text>
          {"\n"}you?
        </Text>

        <Text className="text-center mb-6 text-body leading-relaxed text-muted">
          These help us build your personal feed.{"\n"}
          The rest of Cebu is still yours to explore.
        </Text>

        <InterestGrid selected={selected} onToggle={handleToggle} />
      </View>

      {/* Bottom Button */}
      <View className="px-6 pb-8 pt-4">
        <TouchableOpacity
          className={`items-center rounded-btn py-4 ${
            hasMinSelection ? "bg-brand" : "bg-disabled"
          }`}
          onPress={() => router.push("/(explorer)/(tabs)/explore")}
          disabled={!hasMinSelection}
        >
          <Text
            className={`text-body font-bold ${
              hasMinSelection ? "text-white" : "text-placeholder"
            }`}
          >
            Start Exploring →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
