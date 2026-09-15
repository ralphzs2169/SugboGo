import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import { openGrabBooking } from "../../services/grabHandoff.service";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
};

/**
 * Lets an Explorer choose an available external ride provider.
 *
 * Grab is currently the only supported handoff, while the row-based layout
 * leaves room for verified providers to be added later.
 */
export default function RideProviderSheet({ sheetRef }: Props) {
  const insets = useSafeAreaInsets();
  const handoffPendingRef = useRef(false);
  const [isHandoffPending, setIsHandoffPending] = useState(false);

  async function handleGrabPress() {
    if (handoffPendingRef.current) {
      return;
    }

    handoffPendingRef.current = true;
    setIsHandoffPending(true);

    try {
      const result = await openGrabBooking();

      if (result === "opened") {
        sheetRef.current?.dismiss();
      } else if (result === "unavailable") {
        Toast.show({
          type: "error",
          text1: "Grab isn't available on this device.",
        });
      } else {
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
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      backgroundStyle={{
        backgroundColor: "white",
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.tertiary,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView
        className="px-5 pt-2"
        style={{
          paddingBottom: Math.max(insets.bottom, 28),
        }}
      >
        {/* Sheet context */}
        <AppText weight="bold" className="text-xl text-text-primary">
          Choose a ride
        </AppText>
        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Continue booking with an available ride provider.
        </AppText>

        {/* Available providers */}
        <Pressable
          onPress={handleGrabPress}
          disabled={isHandoffPending}
          accessibilityRole="button"
          accessibilityLabel="Continue booking in Grab"
          accessibilityState={{
            busy: isHandoffPending,
            disabled: isHandoffPending,
          }}
          className="mt-5 min-h-16 cursor-pointer flex-row items-center rounded-xl border border-border-primary bg-surface px-4 py-3 active:opacity-70 disabled:opacity-60"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <MaterialCommunityIcons
              name="car-outline"
              size={22}
              color={theme.extends.colors.brand}
            />
          </View>

          <View className="ml-3 flex-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Grab
            </AppText>
            <AppText className="text-xs text-text-secondary">
              Continue booking in Grab
            </AppText>
          </View>

          <MaterialCommunityIcons
            name={isHandoffPending ? "dots-horizontal" : "chevron-right"}
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
