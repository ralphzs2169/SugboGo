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

      <Stack.Screen
        name="manage-business"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Manage Business",
        }}
      />
      <Stack.Screen
        name="change-requests"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Change Requests",
        }}
      />

      {/* Business information */}
      <Stack.Screen
        name="business-information"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Edit Business Information",
        }}
      />

      <Stack.Screen
        name="operating-hours"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Edit Operating Hours",
        }}
      />

      <Stack.Screen
        name="business-photos"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Manage Business Photos",
        }}
      />

      <Stack.Screen
        name="business-name-change"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Request Name Change",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="business-update-requests/index"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Requested Changes",
        }}
      />
      <Stack.Screen
        name="business-update-requests/[requestId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Name Change Request",
        }}
      />
      <Stack.Screen
        name="classification-change"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Request Classification Change",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="business-update-requests/classification/index"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Classification Requests",
        }}
      />
      <Stack.Screen
        name="business-update-requests/classification/[requestId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Classification Request",
        }}
      />
      <Stack.Screen
        name="location-change/index"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Request Location Change",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="location-change/picker" />
      <Stack.Screen name="location-change/landmarks-picker" />
      <Stack.Screen name="location-change/review-landmarks" />
      <Stack.Screen
        name="business-update-requests/location/index"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Location Requests",
        }}
      />
      <Stack.Screen
        name="business-update-requests/location/[requestId]"
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Location Request",
        }}
      />

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
