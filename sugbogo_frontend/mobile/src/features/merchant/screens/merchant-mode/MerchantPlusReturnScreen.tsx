import { router } from "expo-router";
import { useEffect } from "react";
import { Platform, ScrollView, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import useMerchantPlusPaymentStatus from "../../hooks/payments/useMerchantPlusPaymentStatus";
import MerchantPlusPaymentState from "../../components/merchant-plus/MerchantPlusPaymentState";
import { parseMerchantPlusReturnOutcome } from "../../utils/merchantPlusReturn";
import { hasPaidMerchantPlus } from "../../utils/merchantPlusPayment";

/** Checks backend status after browser return, independently of its navigation hint. */
export default function MerchantPlusReturnScreen({
  outcome: _outcome,
}: {
  outcome: ReturnType<typeof parseMerchantPlusReturnOutcome>;
}) {
  const access = useMerchantPlusPaymentStatus();
  useEffect(() => {
    if (Platform.OS === "ios")
      void WebBrowser.dismissBrowser().catch(() => undefined);
  }, []);
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20,
        }}
      >
        {/* All financial and access messaging comes from the backend. */}
        <View className="mb-4">
          <AppText weight="semibold" className="text-sm text-text-secondary">
            Merchant Plus
          </AppText>
        </View>
        <MerchantPlusPaymentState
          status={access.status}
          error={access.error}
          exhausted={access.exhausted}
          returning
          onCheck={access.checkAgain}
          onContinue={() =>
            router.replace(
              access.exhausted ||
                (hasPaidMerchantPlus(access.status) && !access.error)
                ? "/(merchant)/(tabs)/analytics"
                : "/(merchant)/merchant-plus",
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
