import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BackHandler, Pressable, View } from "react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
import { shadows } from "@/shared/styles/shadows";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import MerchantAccessDirections from "../../MerchantAccessDirections";

type Props = {
  boardingPointName: string;
  boardingDistance: string;
  alightingPointName: string;
  destinationDistance: string;
  landmarkName?: string | null;
  accessDirections?: string | null;
  headerAction?: ReactNode;
};

const BOARDING_BACKGROUND = "#3B82F6";
const BOARDING_COLOR = "#EFF6FF";

const ALIGHTING_BACKGROUND = "#22C55E";
const ALIGHTING_COLOR = "#F0FDF4";

/**
 * Displays the boarding and alighting stops for a selected Jeepney journey.
 *
 * Presents both stops as an ordered sequence with approximate access distances
 * while matching the visual language of the corresponding map markers.
 */
export default function JeepneyStopGuidanceCard({
  boardingPointName,
  boardingDistance,
  alightingPointName,
  destinationDistance,
  landmarkName,
  accessDirections,
  headerAction,
}: Props) {
  const directionsSheet = useRef<BottomSheetModal>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const directions = accessDirections?.trim();

  useEffect(() => {
    if (!directionsOpen) {
      return;
    }

    if (!directions) {
      directionsSheet.current?.dismiss();
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        directionsSheet.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [directions, directionsOpen]);

  return (
    <View
      className="rounded-t-3xl border-t border-border-primary bg-surface px-4 pb-3 pt-3.5"
      style={shadows.docked}
    >
      {/* Guidance heading */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <AppText weight="bold" className="text-base text-text-primary">
            Your stops
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Where to board and get off
          </AppText>
        </View>

        {headerAction ?? (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name="transit-connection-variant"
              size={17}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        )}
      </View>

      <View className="rounded-xl  bg-surface-muted p-3">
        {/* Boarding point */}
        <View className="flex-row items-start">
          <View className="items-center">
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: BOARDING_BACKGROUND,
              }}
            >
              <MaterialCommunityIcons
                name="bus-stop"
                size={18}
                color={BOARDING_COLOR}
              />
            </View>

            <DottedTimelineConnector className="my-1 h-6" />
          </View>

          <View className="ml-3 min-w-0 flex-1 pb-1">
            <View className="flex-row items-center justify-between gap-3">
              <AppText
                weight="bold"
                className="text-[10px] uppercase tracking-wide"
                style={{
                  color: BOARDING_BACKGROUND,
                }}
              >
                Board
              </AppText>

              <View className="rounded-full bg-surface-secondary px-2 py-1">
                <AppText className="text-[10px] text-text-secondary">
                  ~{boardingDistance} from start
                </AppText>
              </View>
            </View>

            <AppText
              weight="semibold"
              className="mt-1 text-sm leading-5 text-text-primary"
              numberOfLines={2}
            >
              {boardingPointName}
            </AppText>
          </View>
        </View>

        {/* Alighting point */}
        <View className="flex-row items-start">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{
              backgroundColor: ALIGHTING_BACKGROUND,
            }}
          >
            <MaterialCommunityIcons
              name="exit-run"
              size={18}
              color={ALIGHTING_COLOR}
            />
          </View>

          <View className="ml-3 min-w-0 flex-1">
            <View className="flex-row items-center justify-between gap-3">
              <AppText
                weight="bold"
                className="text-[10px] uppercase tracking-wide"
                style={{
                  color: ALIGHTING_BACKGROUND,
                }}
              >
                Get off
              </AppText>

              <View className="rounded-full bg-surface-secondary px-2 py-1">
                <AppText className="text-[10px] text-text-secondary">
                  ~{destinationDistance} to destination
                </AppText>
              </View>
            </View>

            <AppText
              weight="semibold"
              className="mt-1 text-sm leading-5 text-text-primary"
              numberOfLines={2}
            >
              {alightingPointName}
            </AppText>

            {landmarkName && (
              <View className="mt-1 flex-row items-center">
                <MaterialCommunityIcons
                  name="map-marker-radius-outline"
                  size={13}
                  color={theme.extends.colors.text.secondary}
                />

                <AppText
                  className="ml-1 min-w-0 flex-1 text-xs text-text-secondary"
                  numberOfLines={1}
                >
                  Near {landmarkName}
                </AppText>
              </View>
            )}
          </View>
        </View>
      </View>
      {/* Merchant context is separate from calculated stops and opens outside the footer. */}
      {directions && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View merchant directions"
          accessibilityHint="Opens final-approach information provided by the merchant"
          accessibilityState={{ expanded: directionsOpen }}
          onPress={() => {
            setDirectionsOpen(true);
            presentBottomSheet(directionsSheet);
          }}
          className="mt-3 min-h-12 flex-row items-center rounded-xl border border-border-primary px-3 py-2 active:opacity-70"
        >
          <View className="min-w-0 flex-1">
            <AppText weight="semibold" className="text-sm text-text-primary">
              Merchant directions
            </AppText>
            <AppText className="mt-0.5 text-xs text-text-secondary">
              Entrance, landmarks and final approach
            </AppText>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
        </Pressable>
      )}
      <BottomSheetModal
        ref={directionsSheet}
        snapPoints={["65%"]}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={() => setDirectionsOpen(false)}
        backgroundStyle={{ backgroundColor: theme.extends.colors.surface }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.5}
          />
        )}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {directionsOpen && directions && (
            <>
              <AppText
                accessibilityRole="header"
                weight="bold"
                className="text-lg text-text-primary"
              >
                Final approach
              </AppText>
              <MerchantAccessDirections directions={directions} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close merchant directions"
                onPress={() => directionsSheet.current?.dismiss()}
                className="min-h-12 items-center justify-center rounded-xl border border-border-primary active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  Close
                </AppText>
              </Pressable>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}
