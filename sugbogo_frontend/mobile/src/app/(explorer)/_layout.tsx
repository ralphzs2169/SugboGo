import { Stack } from "expo-router";
import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

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
    </Stack>
  );
}
