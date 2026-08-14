import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

import SubmissionSuccessScreen from "@/features/merchant/screens/SubmissionSuccessScreen";

export default function SubmissionSuccessPage() {
  const { minBusinessDays, maxBusinessDays } = useLocalSearchParams<{
    minBusinessDays: string;
    maxBusinessDays: string;
  }>();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          router.dismissTo("/(explorer)/profile/merchant-portal");
          return true;
        },
      );

      return () => subscription.remove();
    }, []),
  );

  return (
    <SubmissionSuccessScreen
      reviewSlaMinBusinessDays={Number(minBusinessDays)}
      reviewSlaMaxBusinessDays={Number(maxBusinessDays)}
      onContinue={() => {
        router.dismissTo("/(explorer)/profile/merchant-portal");
      }}
    />
  );
}
