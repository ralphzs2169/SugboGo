import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import { Stack } from "expo-router";

export default function MerchantLayout() {
  useAuthGuard();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />

      {/* Reply templates */}
      <Stack.Screen
        name="reply-templates"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Quick Response Templates",
        }}
      />

      {/* Review disputes */}
      <Stack.Screen
        name="review-disputes/index"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Review Disputes",
        }}
      />
      <Stack.Screen
        name="review-disputes/create/[reviewId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Dispute Review",
        }}
      />
      <Stack.Screen
        name="review-disputes/[disputeId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Dispute Details",
        }}
      />
    </Stack>
  );
}
