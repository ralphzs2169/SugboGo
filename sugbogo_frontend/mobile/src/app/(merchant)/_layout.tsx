import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import { Stack } from "expo-router";

export default function MerchantLayout() {
  useAuthGuard();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
