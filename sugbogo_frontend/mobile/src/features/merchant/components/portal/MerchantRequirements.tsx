import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const REQUIREMENTS = [
  {
    title: "Business information",
    description: "Provide your business name, category, and basic details.",
  },
  {
    title: "Business location",
    description: "Pin your business location and nearby landmarks.",
  },
  {
    title: "Operating hours",
    description: "Set your opening and closing schedule.",
  },
  {
    title: "Business photos",
    description: "Upload photos that showcase your business.",
  },
  {
    title: "Verification documents",
    description: "Submit documents required for business verification.",
  },
] as const;

/**
 * Displays the information users should prepare before
 * starting their merchant registration.
 *
 * Shows the required details, verification needs, and
 * estimated completion time for the registration process.
 */
export default function MerchantRequirements() {
  return (
    <View className="bg-surface px-6 py-6">
      <AppText weight="extrabold" className="mb-2 text-3xl  text-text-primary">
        Before you begin
      </AppText>

      <AppText weight="medium" className="mb-8  text-text-secondary">
        Prepare these details to complete your merchant registration smoothly.
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

      <View className="mt-8 flex-row items-center justify-between border-t border-border-primary pt-5">
        <View>
          <AppText
            weight="medium"
            className="text-xs  uppercase tracking-wider text-text-secondary"
          >
            Estimated Time
          </AppText>

          <AppText
            weight="superbold"
            className="mt-1 text-lg  text-text-primary"
          >
            10–15 minutes
          </AppText>
        </View>

        <MaterialCommunityIcons
          name="clock-outline"
          size={24}
          color={theme.extends.colors.brand}
        />
      </View>
    </View>
  );
}
