import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import { Stack } from "expo-router";

export default function ExplorerLayout() {
  useAuthGuard();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      <Stack.Screen
        name="profile"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Profile",
        }}
      />

      <Stack.Screen
        name="merchant-registration"
        options={{
          headerShown: false,
          animation: "slide_from_right",
          // Native-stack defaults `replace()` navigations to a "pop"-style
          // animation (fade, on Android) even when moving forward. This
          // forces replace() to animate like push() instead, so the
          // transition into this group is consistent no matter whether
          // it's entered via push or replace.
          animationTypeForReplace: "push",
        }}
      />

      <Stack.Screen
        name="submission-success"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
