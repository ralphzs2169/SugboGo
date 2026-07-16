import "../../global.css";
import { Stack } from "expo-router";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";

export default function RootLayout() {
  useRestoreSession();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(explorer)" />
      <Stack.Screen name="(setup)" />
    </Stack>
  );
}
