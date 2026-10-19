import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useCallback, type ReactNode, type RefObject } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import useBottomSheetBackHandler from "@/shared/hooks/useBottomSheetBackHandler";

const SNAP_POINTS = ["70%", "90%"];

/** Shares modal behavior and accessible chrome while each report owns its explanations. */
export default function AnalyticsReportSheet({
  sheetRef,
  title,
  description,
  closeLabel,
  onDismiss,
  snapPoints = SNAP_POINTS,
  stackBehavior,
  children,
}: {
  sheetRef: RefObject<BottomSheetModal | null>;
  title: string;
  description?: string;
  closeLabel: string;
  onDismiss?: () => void;
  snapPoints?: (string | number)[];
  stackBehavior?: "push" | "switch" | "replace";
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const backHandler = useBottomSheetBackHandler(sheetRef);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      stackBehavior={stackBehavior}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={backdrop}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      onChange={backHandler.onChange}
      onDismiss={() => {
        backHandler.onDismiss();
        onDismiss?.();
      }}
    >
      <BottomSheetScrollView
        contentContainerClassName="px-5 pt-2"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Plain title and close action; no decorative header icon. */}
        <View className="mb-5 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <AppText
              weight="bold"
              accessibilityRole="header"
              className="text-xl text-text-primary"
            >
              {title}
            </AppText>
            {description && (
              <AppText className="text-sm leading-5 text-text-secondary">
                {description}
              </AppText>
            )}
          </View>
          <SafePressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            className="h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={23}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>
        </View>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
