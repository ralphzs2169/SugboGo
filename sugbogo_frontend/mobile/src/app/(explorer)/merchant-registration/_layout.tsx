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

      <Stack
        screenOptions={{
          animation: "none",
        }}
      >
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
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="submitted-application"
          options={{
            ...defaultStackScreenOptions,
            ...slideFromRight,
            animationTypeForReplace: "push",
            title: "Application Summary",
          }}
        />

        <Stack.Screen
          name="submission-success"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
