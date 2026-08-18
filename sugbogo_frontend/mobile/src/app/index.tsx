import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useVerificationStore } from "@/features/auth/store/verification.store";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import * as onboardingStorage from "@/shared/api/onboardingStorage.service";

export default function Index() {
  const [completedOnboarding, setCompletedOnboarding] = useState<
    boolean | null
  >(null);

  const { user, isAuthenticated } = useAuthStore();

  const activeMode = useAppModeStore((state) => state.activeMode);

  const pendingEmail = useVerificationStore((state) => state.pendingEmail);

  useEffect(() => {
    async function checkOnboarding() {
      const completed = await onboardingStorage.hasCompletedOnboarding();

      setCompletedOnboarding(completed);
    }

    checkOnboarding();
  }, []);

  if (completedOnboarding === null) {
    return null;
  }

  if (!completedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!isAuthenticated) {
    if (pendingEmail) {
      return (
        <Redirect
          href={{
            pathname: "/(auth)/verify-email",
            params: {
              email: pendingEmail,
            },
          }}
        />
      );
    }

    return <Redirect href="/(auth)/login" />;
  }

  if (!user?.has_completed_interest_selection) {
    return <Redirect href="/(setup)/interests" />;
  }

  if (activeMode === "merchant") {
    return <Redirect href="/(merchant)/(tabs)/dashboard" />;
  }

  return <Redirect href="/(explorer)/(tabs)/explore" />;
}
