import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useEffect, type RefObject } from "react";
import {
  BackHandler,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import MerchantAccessDirections from "./MerchantAccessDirections";
import { LANDMARK_MARKER_ICON } from "@/shared/components/MapMarker";
import type { ArrivalLandmark } from "../../types/directJourney.types";

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  directions?: string | null;
  arrivalDetails?: boolean;
  arrivalLandmark?: ArrivalLandmark | null;
  destinationName?: string;
  isOpen: boolean;
  onDismiss: () => void;
};

/** Presents full merchant access notes consistently from Jeepney results and maps. */
export default function MerchantAccessNotesSheet({
  sheetRef,
  directions,
  arrivalDetails = false,
  arrivalLandmark,
  destinationName,
  isOpen,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const text = directions?.trim();
  const entranceDirections = arrivalLandmark?.access_directions?.trim();
  const hasEntranceDirections = Boolean(entranceDirections);
  const hasContent = Boolean(text) || hasEntranceDirections;
  const title = arrivalDetails ? "Arrival details" : "Access notes";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!hasContent) {
      sheetRef.current?.dismiss();
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
  }, [isOpen, sheetRef, hasContent]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      maxDynamicContentSize={height * 0.75}
      topInset={insets.top}
      enablePanDownToClose
      onDismiss={onDismiss}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
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
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 24) + 8,
        }}
      >
        {isOpen && hasContent && (
          <>
            {/* Sheet controls are separate from the merchant's statement. */}
            <View className="flex-row items-center gap-3">
              <AppText
                accessibilityRole="header"
                weight="bold"
                className="min-w-0 flex-1 text-xl text-text-primary"
              >
                {title}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  arrivalDetails
                    ? "Close arrival details"
                    : "Close access notes"
                }
                onPress={() => sheetRef.current?.dismiss()}
                className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </Pressable>
            </View>
            {arrivalLandmark && entranceDirections && (
              <View className="mt-3 rounded-xl bg-surface-muted p-4">
                <AppText
                  accessibilityRole="header"
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Entrance directions
                </AppText>
                <View className="mt-3 flex-row items-start gap-2">
                  <MaterialCommunityIcons
                    name={LANDMARK_MARKER_ICON}
                    size={18}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                  <View className="min-w-0 flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {destinationName
                        ? `${arrivalLandmark.name} → ${destinationName}`
                        : `From ${arrivalLandmark.name}`}
                    </AppText>
                  </View>
                </View>
                <AppText
                  selectable
                  className="mt-3 text-sm leading-5 text-text-primary"
                >
                  {entranceDirections}
                </AppText>
                <AppText className="mt-2 text-xs text-text-secondary">
                  Directions from the business
                </AppText>
              </View>
            )}
            {text && (
              <View
                className={
                  hasEntranceDirections
                    ? "mt-4 border-t border-border-primary pt-4"
                    : "mt-2"
                }
              >
                {arrivalDetails && (
                  <AppText
                    accessibilityRole="header"
                    weight="semibold"
                    className="mb-2 text-sm text-text-primary"
                  >
                    Access notes
                  </AppText>
                )}
                {arrivalDetails && hasEntranceDirections ? (
                  <AppText
                    selectable
                    className="text-sm leading-5 text-text-secondary"
                  >
                    {text}
                  </AppText>
                ) : (
                  <MerchantAccessDirections
                    directions={text}
                    collapsible={false}
                    presentation="sheet"
                    className="mt-1"
                  />
                )}
              </View>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
