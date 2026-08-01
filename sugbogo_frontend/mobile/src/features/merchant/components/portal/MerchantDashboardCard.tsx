import Button from "@/shared/components/Button";
import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type MerchantDashboardCardProps = {
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
export default function MerchantDashboardCard({
  businessName,
  approvedAt,
  onOpenDashboard,
}: MerchantDashboardCardProps) {
  return (
    <View className="bg-surface px-6 py-6">
      <Text className="mb-2 text-3xl font-bold text-text-primary">
        Welcome to SugboGo
      </Text>

      <Text className="mb-6 text-md text-text-secondary">
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
            color={theme.extends.colors.brand}
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
