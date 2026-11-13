import { useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { merchantApplicationKeys } from "@/features/merchant/hooks/merchantApplicationQueryKeys";
import SubmissionSuccessScreen from "@/features/merchant/screens/SubmissionSuccessScreen";

export default function SubmissionSuccessPage() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const { minBusinessDays, maxBusinessDays } = useLocalSearchParams<{
    minBusinessDays: string;
    maxBusinessDays: string;
  }>();

  useEffect(() => {
    if (!userId) return;

    // Refresh after leaving Review so its route guard cannot redirect mid-replacement.
    void queryClient.invalidateQueries({
      queryKey: merchantApplicationKeys.current(userId),
    });
    void queryClient.invalidateQueries({
      queryKey: merchantApplicationKeys.status(userId),
    });
  }, [queryClient, userId]);

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
