import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

export default function BusinessLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="reviews"
          options={{
            title: "Reviews",
          }}
        />

        <Stack.Screen
          name="getting-there"
          options={{
            title: "Getting There",
          }}
        />

        <Stack.Screen
          name="road-route"
          options={{
            title: "Road Route",
          }}
        />
      </Stack>
    </>
  );
}
