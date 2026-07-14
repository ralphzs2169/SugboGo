import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import * as onboardingStorage from "../shared/services/onboardingStorage";

/**
 * Root route that determines the app's initial destination.
 */
export default function Index() {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      // Development only.
      await onboardingStorage.resetOnboarding();

      const hasCompleted = await onboardingStorage.hasCompletedOnboarding();

      setCompleted(hasCompleted);
    };

    checkOnboarding();
  }, []);

  if (completed === null) {
    return null;
  }

  return <Redirect href={completed ? "/(auth)/login" : "/onboarding"} />;
}
