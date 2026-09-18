import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import GrabLogo from "../../assets/ride-provider-icons/grab-logo.svg";
import { openGrabBooking } from "../../services/grabHandoff.service";
import {
  openMaxim,
  openMoveIt,
  type RideProviderHandoffResult,
} from "../../services/rideProviderHandoff.service";

const MOVE_IT_LOGO = require("../../assets/ride-provider-icons/move-it-logo.png");
const MAXIM_LOGO = require("../../assets/ride-provider-icons/maxim-logo-2.png");

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
};

type ProviderHandoffResult =
  | RideProviderHandoffResult
  | "unavailable";

type RideProvider = {
  id: "grab" | "move-it" | "maxim";
  name: string;
  description: string;
  logoSource: ImageSource | null;
  accessibilityLabel: string;
  unavailableMessage?: string;
  handoff: () => Promise<ProviderHandoffResult>;
};

const RIDE_PROVIDERS = [
  {
    id: "grab",
    name: "Grab",
    description: "Continue booking in Grab",
    logoSource: null,
    accessibilityLabel: "Continue booking in Grab",
    unavailableMessage: "Grab isn't available on this device.",
    handoff: openGrabBooking,
  },
  {
    id: "move-it",
    name: "Move It",
    description: "Open Move It",
    logoSource: MOVE_IT_LOGO,
    accessibilityLabel: "Open Move It",
    handoff: openMoveIt,
  },
  {
    id: "maxim",
    name: "Maxim",
    description: "Open Maxim",
    logoSource: MAXIM_LOGO,
    accessibilityLabel: "Open Maxim",
    handoff: openMaxim,
  },
] satisfies RideProvider[];

/**
 * Lets an Explorer hand off to an available external ride provider.
 */
export default function RideProviderSheet({ sheetRef }: Props) {
  const insets = useSafeAreaInsets();
  const handoffPendingRef = useRef(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [pendingProviderId, setPendingProviderId] = useState<
    RideProvider["id"] | null
  >(null);
  const isHandoffPending = pendingProviderId !== null;

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isSheetOpen, sheetRef]);

  async function handleProviderPress(provider: RideProvider) {
    if (handoffPendingRef.current) {
      return;
    }

    handoffPendingRef.current = true;
    setPendingProviderId(provider.id);

    try {
      const result = await provider.handoff();

      if (result === "opened" || result === "store-opened") {
        sheetRef.current?.dismiss();
        return;
      }

      if (result === "unavailable" && provider.unavailableMessage) {
        Toast.show({
          type: "error",
          text1: provider.unavailableMessage,
        });
        return;
      }

      Toast.show({
        type: "error",
        text1: `Unable to open ${provider.name}.`,
        text2: "Please try again.",
      });
    } finally {
      handoffPendingRef.current = false;
      setPendingProviderId(null);
    }
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      enableDynamicSizing
      onChange={(index) => {
        setIsSheetOpen(index >= 0);
      }}
      onDismiss={() => {
        setIsSheetOpen(false);
      }}
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
        <View className="mt-5 gap-3">
          {RIDE_PROVIDERS.map((provider) => {
            const isSelectedProviderPending =
              pendingProviderId === provider.id;

            return (
              <Pressable
                key={provider.id}
                onPress={() => void handleProviderPress(provider)}
                disabled={isHandoffPending}
                accessibilityRole="button"
                accessibilityLabel={provider.accessibilityLabel}
                accessibilityState={{
                  busy: isSelectedProviderPending,
                  disabled: isHandoffPending,
                }}
                className="min-h-16 cursor-pointer flex-row items-center rounded-xl border border-border-primary bg-surface px-4 py-3 active:opacity-70 disabled:opacity-60"
              >
                <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white">
                  {provider.id === "grab" ? (
                    <GrabLogo
                      testID="ride-provider-logo-grab"
                      width={40}
                      height={30}
                    />
                  ) : (
                    <Image
                      testID={`ride-provider-logo-${provider.id}`}
                      source={provider.logoSource}
                      style={{
                        width: 40,
                        height: 40,
                      }}
                      contentFit="contain"
                    />
                  )}
                </View>

                <View className="ml-3 flex-1">
                  <AppText weight="bold" className="text-base text-text-primary">
                    {provider.name}
                  </AppText>
                  <AppText className="text-xs text-text-secondary">
                    {provider.description}
                  </AppText>
                </View>

                {isSelectedProviderPending ? (
                  <ActivityIndicator
                    testID={`ride-provider-pending-${provider.id}`}
                    size="small"
                    color={theme.extends.colors.brand}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={theme.extends.colors.text.secondary}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
