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

      {/* Business profile */}
      <Stack.Screen
        name="business/[businessId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: false,
        }}
      />

      {/* Explorer profile */}
      <Stack.Screen
        name="profile"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Profile",
        }}
      />

      {/* Merchant registration */}
      <Stack.Screen
        name="merchant-registration"
        options={{
          headerShown: false,
          animation: "slide_from_right",
          animationTypeForReplace: "push",
        }}
      />
    </Stack>
  );
}
