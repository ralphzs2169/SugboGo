import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import MerchantIllustration from "../assets/merchant-register-illustration.svg";
import { theme } from "@/constants/theme";

type MerchantCardProps = {
  onPress: () => void;
};

export default function MerchantCard({ onPress }: MerchantCardProps) {
  return (
    <View className="mt-6  rounded-l-[40px] bg-[#ff860e]/90 p-5">
      <View className="flex-row items-center">
        <View style={{ width: 110, height: 92 }}>
          <MerchantIllustration width={110} height={92} />
        </View>

        <View className="flex-1 pl-3">
          <Text className="text-sm font-bold uppercase tracking-wide text-white">
            Own a business?
          </Text>

          <Text className="mt-1 text-xs font-semibold text-white">
            Digitize your shop and reach more explorers in Cebu.
          </Text>

          <TouchableOpacity
            className="mt-3 flex-row items-center justify-center bg-white px-3 py-2 rounded-full active:opacity-70 "
            onPress={onPress}
          >
            <Text className="text-xs mr-2 font-bold text-brand">
              Register my Business
            </Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={16}
              color={theme.extends.colors.brand}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
