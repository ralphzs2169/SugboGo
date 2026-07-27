import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

const REQUIREMENTS = [
  "Business information",
  "Business location",
  "Operating hours",
  "Business photos",
  "Verification documents",
] as const;

export default function MerchantRequirements() {
  return (
    <View className="mt-6 px-6">
      <Text className="mb-4 text-lg font-bold text-foreground">
        Before you begin
      </Text>

      <View className="rounded-2xl bg-card p-5">
        {REQUIREMENTS.map((item, index) => (
          <View
            key={item}
            className={`flex-row items-center ${
              index !== REQUIREMENTS.length - 1 ? "mb-3" : ""
            }`}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={20}
              color="#22C55E"
            />

            <Text className="ml-3 flex-1 text-base text-foreground">
              {item}
            </Text>
          </View>
        ))}

        <View className="mt-5 border-t border-border pt-5">
          <Text className="text-sm font-semibold text-muted-foreground">
            Estimated completion time
          </Text>

          <Text className="mt-1 text-base font-semibold text-foreground">
            5–10 minutes
          </Text>
        </View>
      </View>
    </View>
  );
}
