import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

export default function MerchantRegistrationLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack>
        <Stack.Screen
          name="index"
          options={{
            ...defaultStackScreenOptions,
            ...slideFromRight,
            title: "Merchant Registration",
          }}
        />

        <Stack.Screen
          name="location-picker"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />

        <Stack.Screen
          name="landmarks-picker"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
          }}
        />

        <Stack.Screen
          name="review-landmarks"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
