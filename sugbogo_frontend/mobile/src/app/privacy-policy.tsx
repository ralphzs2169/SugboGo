import { Stack } from "expo-router";

import PrivacyPolicyScreen from "@/features/legal/screens/PrivacyPolicyScreen";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

/** Opens the public Privacy Policy page outside authenticated route groups. */
export default function PrivacyPolicyRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Privacy Policy",
        }}
      />
      <PrivacyPolicyScreen />
    </>
  );
}
