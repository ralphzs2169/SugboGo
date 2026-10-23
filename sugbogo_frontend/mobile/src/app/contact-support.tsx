import { Stack } from "expo-router";

import ContactSupportScreen from "@/features/support/screens/ContactSupportScreen";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

/** Opens public support information outside authenticated route groups. */
export default function ContactSupportRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          headerShown: true,
          title: "Contact Support",
        }}
      />
      <ContactSupportScreen />
    </>
  );
}
