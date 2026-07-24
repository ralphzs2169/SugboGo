import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
};

export default function AvatarInfoCard({ visible }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View className="mt-4 flex-row items-start rounded-xl bg-blue-50 px-4 py-3">
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color="#2563EB"
        />
      </View>

      <View className="flex-1">
        <Text className="text-sm font-semibold text-blue-900">
          Social profile photo in use
        </Text>

        <Text className="mt-1 text-xs leading-5 text-blue-700">
          Your Google or Facebook photo is currently being used. You can change
          this preference in Account Settings or Upload a new photo to replace
          it
        </Text>
      </View>
    </View>
  );
}
