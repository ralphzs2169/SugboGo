import AcceptedStatusIllustration from "../../assets/illustrations/application-accepted.svg";
import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type AcceptedApplicationSectionProps = {
  businessName: string;
  approvedAt: string;
  onOpenDashboard: () => void;
};

/**
 * Welcomes newly approved merchants and provides
 * access to the Merchant Dashboard.
 *
 * Displayed once the merchant application has been
 * approved by an administrator.
 */
export default function AcceptedApplicationSection({
  businessName,
  approvedAt,
  onOpenDashboard,
}: AcceptedApplicationSectionProps) {
  return (
    <View className="bg-surface px-6 py-6">
      <AcceptedStatusIllustration width="100%" height={180} />
      <Text className="mb-2 mt-6 text-2xl font-bold text-text-primary text-center">
        Welcome to SugboGo
      </Text>

      <Text className="mb-6 text-md text-text-secondary text-center">
        Your merchant account is now active and ready to help you grow your
        business.
      </Text>

      <View>
        {/* Status */}
        <View className="flex-row items-start gap-3 border-b border-border-primary/60 py-3">
          <MaterialCommunityIcons
            name="check-decagram"
            size={22}
            color={theme.extends.colors.success}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Merchant Approved
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              Congratulations! Your business is now visible on SugboGo.
            </Text>
          </View>
        </View>

        {/* Business */}
        <View className="flex-row items-start gap-3 border-b border-border-primary/60 py-3">
          <MaterialCommunityIcons
            name="storefront-outline"
            size={22}
            color={theme.extends.colors.brand}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Business
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {businessName}
            </Text>
          </View>
        </View>

        {/* Approval Date */}
        <View className="flex-row items-start gap-3 py-3">
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={22}
            color={theme.extends.colors.text.secondary}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Approved On
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {approvedAt}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
