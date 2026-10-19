import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, type RefObject } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

const NOTES = [
  "Each account contributes at most one recorded profile visit per business per UTC day. A new UTC day starts at 8 AM in Manila.",
  "The first successfully recorded source that day is preserved. Later openings through other sources do not replace it.",
  "Sources are reported by the app, not independently verified. Delivery may be incomplete.",
  "Historical visits and visits from unclassified entry points may appear under Source not recorded.",
  "These are online business-profile openings, not confirmed physical visits.",
];

/** Explains daily first-recorded attribution using the existing Gorhom sheet pattern. */
export default function DiscoverySourcesMeasurementSheet({
  sheetRef,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
}) {
  const insets = useSafeAreaInsets();
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={sheetRef}
      enablePanDownToClose
      topInset={insets.top}
      backdropComponent={backdrop}
      backgroundStyle={{ backgroundColor: theme.extends.colors.surface }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Title and explicit dismissal */}
        <View className="mb-4 flex-row items-center justify-between gap-3">
          <AppText
            weight="bold"
            accessibilityRole="header"
            className="min-w-0 flex-1 text-xl text-text-primary"
          >
            About visit sources
          </AppText>
          <SafePressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close visit-source information"
            className="min-h-12 justify-center px-2 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Close
            </AppText>
          </SafePressable>
        </View>
        {/* Measurement definitions and limitations */}
        <View className="gap-4">
          {NOTES.map((note) => (
            <AppText
              key={note}
              className="text-sm leading-6 text-text-secondary"
            >
              {note}
            </AppText>
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
