import { Stack } from "expo-router";

import FaqsScreen from "@/features/support/screens/FaqsScreen";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

/** Opens the FAQ list from Profile. */
export default function FaqsRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "FAQs",
        }}
      />
      <FaqsScreen />
    </>
  );
}
