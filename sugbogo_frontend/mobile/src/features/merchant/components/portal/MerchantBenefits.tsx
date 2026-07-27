import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * Displays the benefits of becoming a SugboGo merchant.
 *
 * This section is shown to users who have not yet started
 * their merchant registration and highlights the value
 * of joining the SugboGo merchant program.
 */

const BENEFITS = [
  {
    icon: "storefront-outline",
    title: "Promote your business",
  },
  {
    icon: "account-group-outline",
    title: "Reach more explorers",
  },
  {
    icon: "star-outline",
    title: "Receive reviews and ratings",
  },
  {
    icon: "chart-line",
    title: "Access merchant insights",
  },
] as const;

export default function MerchantBenefits() {
  return (
    <View className="mt-10 px-6">
      <Text className="mb-4 text-lg font-bold text-foreground">
        Why become a merchant?
      </Text>

      <View className="rounded-2xl bg-card p-5">
        {BENEFITS.map((benefit, index) => (
          <View
            key={benefit.title}
            className={`flex-row items-center ${
              index !== BENEFITS.length - 1 ? "mb-4" : ""
            }`}
          >
            <MaterialCommunityIcons
              name={benefit.icon}
              size={22}
              color="#F27F0D"
            />

            <Text className="ml-3 flex-1 text-base text-foreground">
              {benefit.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
