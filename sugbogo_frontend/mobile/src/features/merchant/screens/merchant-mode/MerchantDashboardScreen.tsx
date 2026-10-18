import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import AppText from "@/shared/components/AppText";

import MerchantScreenHeader from "../../layout/MerchantScreenHeader";

/**
 * Displays the Merchant dashboard shell with account-level notification access.
 *
 * The existing dashboard placeholder remains intact below the shared header.
 */
export default function MerchantDashboardScreen() {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Dashboard header */}
      <MerchantScreenHeader
        title="Dashboard"
        rightAccessory={<NotificationBellButton />}
      />

      {/* Existing dashboard placeholder */}
      <View className="flex-1 items-center justify-center">
        <AppText weight="semibold" className="text-xl text-text-primary">
          Merchant Dashboard
        </AppText>
      </View>
    </SafeAreaView>
  );
}
