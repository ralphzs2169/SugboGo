import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type MerchantDashboardCardProps = {
  businessName: string;
  approvedAt: string;
  onOpenDashboard: () => void;
};

/**
 * Welcomes newly approved merchants and provides
 * access to merchant-specific features.
 */
export default function MerchantDashboardCard({
  businessName,
  approvedAt,
  onOpenDashboard,
}: MerchantDashboardCardProps) {
  return (
    <View className="mx-6 mt-6 rounded-2xl bg-card p-5">
      <View className="items-center">
        <MaterialCommunityIcons
          name="check-decagram"
          size={56}
          color="#22C55E"
        />

        <Text className="mt-3 text-xl font-bold text-foreground">
          Welcome, Merchant!
        </Text>

        <Text className="mt-2 text-center text-base text-muted-foreground">
          {businessName}
        </Text>
      </View>

      <View className="mt-6 border-t border-border pt-6">
        <Text className="text-sm font-semibold text-muted-foreground">
          Approved
        </Text>

        <Text className="mt-1 text-base text-foreground">{approvedAt}</Text>
      </View>

      <View className="mt-6">
        <Button title="Go to Merchant Dashboard" onPress={onOpenDashboard} />
      </View>
    </View>
  );
}
