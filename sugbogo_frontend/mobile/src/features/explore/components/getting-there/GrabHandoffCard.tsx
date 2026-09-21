import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import { openGrabBooking } from "../../services/grabHandoff.service";

/** Offers an explicit, guarded handoff from SugboGo to Grab booking. */
export default function GrabHandoffCard() {
  const handoffPendingRef = useRef(false);
  const [isHandoffPending, setIsHandoffPending] = useState(false);

  async function handleBookWithGrab() {
    if (handoffPendingRef.current) {
      return;
    }

    handoffPendingRef.current = true;
    setIsHandoffPending(true);

    try {
      const result = await openGrabBooking();

      if (result === "unavailable") {
        Toast.show({
          type: "error",
          text1: "Grab isn't available on this device.",
        });
      }

      if (result === "failed") {
        Toast.show({
          type: "error",
          text1: "Unable to open Grab.",
          text2: "Please try again.",
        });
      }
    } finally {
      handoffPendingRef.current = false;
      setIsHandoffPending(false);
    }
  }

  return (
    <View className="mt-7 rounded-card border border-border-primary bg-surface p-4">
      {/* Grab handoff identity */}
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <MaterialCommunityIcons
            name="car-outline"
            size={22}
            color={theme.extends.colors.brand}
          />
        </View>

        <View className="ml-3 flex-1">
          <AppText weight="bold" className="text-base text-text-primary">
            Book with Grab
          </AppText>
          <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
            Continue pickup, destination, and booking in Grab.
          </AppText>
        </View>
      </View>

      {/* Explicit external-app action */}
      <Button
        title="Book with Grab"
        onPress={handleBookWithGrab}
        loading={isHandoffPending}
        disabled={isHandoffPending}
        rounded="full"
        variant="soft"
        className="mt-4 py-3"
        fontClassName="text-sm"
        accessibilityLabel="Continue booking in Grab"
      />
    </View>
  );
}
