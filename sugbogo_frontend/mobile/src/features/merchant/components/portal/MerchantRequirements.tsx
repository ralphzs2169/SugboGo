import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const REQUIREMENTS = [
  {
    title: "Business location",
    description:
      "Have your full address ready and pin your business within SugboGo’s Cebu City service area. Nearby landmarks are optional.",
  },
  {
    title: "Storefront photo",
    description: "Prepare at least one clear photo of your storefront.",
  },
  {
    title: "Proof of business registration",
    description:
      "Prepare one document, such as a DTI certificate, SEC certificate, or Mayor’s permit. If you’re applying on behalf of the owner, you can also upload an authorization letter or signed form.",
  },
  {
    title: "Business details",
    description:
      "Enter your business name, a short description, a Philippine mobile number, and the representative’s name and role. Choose your business cluster, category, and three specialty tags in the form.",
  },
  {
    title: "Operating hours",
    description:
      "Set your hours for each day of the week and mark the days you’re closed.",
  },
] as const;

/**
 * Shows applicants what to prepare for merchant registration and reminds them
 * that they can continue later.
 */
export default function MerchantRequirements() {
  return (
    <View className="bg-surface px-6 py-6">
      <AppText weight="extrabold" className="mb-2 text-3xl text-text-primary">
        Before you begin
      </AppText>

      <View>
        {REQUIREMENTS.map((item, index) => (
          <View
            key={item.title}
            className={
              "flex-row items-start gap-2 py-3" +
              (index !== REQUIREMENTS.length - 1
                ? " border-b border-border-primary/60"
                : "")
            }
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={22}
              color={theme.extends.colors.success}
              style={{ marginTop: 2 }}
            />

            <View className="flex-1">
              <AppText weight="bold" className="text-base  text-text-primary">
                {item.title}
              </AppText>

              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                {item.description}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-8 border-t border-border-primary pt-5">
        <AppText weight="medium" className="text-text-secondary">
          You can save your progress and continue later.
        </AppText>
      </View>
    </View>
  );
}
