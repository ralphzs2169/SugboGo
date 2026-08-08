import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

import SubmissionSuccessScreen from "@/features/merchant/screens/SubmissionSuccessScreen";

export default function SubmissionSuccessPage() {
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
      onContinue={() => {
        router.dismissTo("/(explorer)/profile/merchant-portal");
      }}
    />
  );
}
