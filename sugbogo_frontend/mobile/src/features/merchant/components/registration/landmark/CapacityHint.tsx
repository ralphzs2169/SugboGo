import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type LandmarkCapacityHintProps = {
  remaining: number;
  max: number;
};

/**
 * Displays how many more landmarks the merchant can add.
 */
export default function CapacityHint({
  remaining,
  max,
}: LandmarkCapacityHintProps) {
  if (remaining <= 0) {
    return null;
  }

  const message =
    remaining === max
      ? `You can add up to ${max} nearby landmarks to help explorers find your business.`
      : remaining === 1
        ? "You can add 1 more nearby landmark."
        : `You can add ${remaining} more nearby landmarks.`;

  return (
    <View className="mt-3 flex-row items-center rounded-xl bg-blue-50 px-4 py-3">
      <View className=" h-8 w-8 items-center justify-center rounded-full ">
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color="#2563EB"
        />
      </View>

      <Text className="flex-1 text-sm leading-5 text-blue-700">{message}</Text>
    </View>
  );
}
