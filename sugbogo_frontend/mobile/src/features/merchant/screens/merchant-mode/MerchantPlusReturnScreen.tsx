import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import useMerchantPlusAccess from "../../hooks/analytics/useMerchantPlusAccess";
import { parseMerchantPlusReturnOutcome } from "../../utils/merchantPlusReturn";

/** Refreshes authoritative access once on focus while the full M6 return UX is pending. */
export default function MerchantPlusReturnScreen({
  outcome,
}: {
  outcome: ReturnType<typeof parseMerchantPlusReturnOutcome>;
}) {
  const { refetch } = useMerchantPlusAccess();
  useFocusEffect(useCallback(() => {
    void refetch();
  }, [refetch, outcome]));

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Navigation confirmation uses no provider or payment assertions. */}
      <View className="flex-1 justify-center gap-4 px-5">
        <AppText weight="semibold" className="text-xl text-text-primary">
          Back in SugboGo
        </AppText>
        <AppText className="text-text-secondary">
          SugboGo is checking your access with the backend. You can continue to Analytics.
        </AppText>
        <Button title="Continue to Analytics" onPress={() => router.replace("/(merchant)/(tabs)/analytics")} />
      </View>
    </SafeAreaView>
  );
}
