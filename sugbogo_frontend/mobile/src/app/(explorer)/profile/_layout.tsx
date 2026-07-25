import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

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
