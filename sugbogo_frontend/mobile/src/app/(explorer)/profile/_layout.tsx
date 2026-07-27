import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

/**
 * Layout for the profile feature stack.
 * This layout defines the navigation structure for the profile-related screens,
 * including the main profile screen, edit profile screen, and account settings.
 * It applies consistent navigation options for a cohesive user experience.
 */
export default function ProfileLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack>
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="edit-profile"
          options={{
            ...defaultStackScreenOptions,
            ...slideFromRight,
            title: "Edit Profile",
          }}
        />
        <Stack.Screen
          name="merchant/index"
          options={{
            ...defaultStackScreenOptions,
            ...slideFromRight,
            title: "Merchant Registration Portal",
          }}
        />

        <Stack.Screen
          name="account-settings"
          options={{
            ...defaultStackScreenOptions,
            title: "Account Settings",
          }}
        />
      </Stack>
    </>
  );
}
