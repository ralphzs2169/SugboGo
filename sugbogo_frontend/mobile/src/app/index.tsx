import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import * as onboardingStorage from "@/shared/services/onboardingStorage";
import { useAuthStore } from "@/features/auth/store/auth.store";

export default function Index() {
  const [completedOnboarding, setCompletedOnboarding] = useState<
    boolean | null
  >(null);

  const { user, isAuthenticated } = useAuthStore();

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
    return <Redirect href="/(auth)/login" />;
  }

  if (!user?.has_completed_interest_selection) {
    return <Redirect href="/(setup)/interests" />;
  }

  return <Redirect href="/(explorer)/(tabs)/explore" />;
}
