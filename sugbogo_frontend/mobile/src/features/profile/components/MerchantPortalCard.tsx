import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import MerchantIllustration from "../../merchant/assets/illustrations/merchant-portal-no-shadow.svg";
import { theme } from "@/constants/theme";

type MerchantPortalCardProps = {
  title: string;
  description: string;
  buttonTitle: string;
  onPress: () => void;
};

/**
 * Displays the user's merchant entry point from the
 * explorer profile.
 *
 * The card adapts its content according to the current
 * merchant registration status and navigates users to
 * the Merchant Portal.
 */
export default function MerchantCard({
  title,
  description,
  buttonTitle,
  onPress,
}: MerchantPortalCardProps) {
  return (
    <View className="mt-6  rounded-l-[40px] rounded-r-md  bg-[#ff860e]/90 p-4">
      <View className="flex-row items-center">
        <View>
          <MerchantIllustration width={120} height={112} />
        </View>

        <View className="flex-1 pl-3">
          <Text className="text-sm font-bold uppercase tracking-wide text-white">
            {title}
          </Text>

          <Text className="mt-1 text-xs font-semibold text-white">
            {description}
          </Text>

          <TouchableOpacity
            className="mt-3 flex-row items-center justify-center bg-white px-3 py-2 rounded-full active:opacity-70 "
            onPress={onPress}
          >
            <Text className="text-xs mr-2 font-bold text-brand">
              {buttonTitle}
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
