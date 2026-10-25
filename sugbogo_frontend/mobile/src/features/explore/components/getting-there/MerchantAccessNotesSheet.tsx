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

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  directions?: string | null;
  isOpen: boolean;
  onDismiss: () => void;
};

/** Presents full merchant access notes consistently from Jeepney results and maps. */
export default function MerchantAccessNotesSheet({
  sheetRef,
  directions,
  isOpen,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const text = directions?.trim();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!text) {
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
  }, [isOpen, sheetRef, text]);

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
        {isOpen && text && (
          <>
            {/* Sheet controls are separate from the merchant's statement. */}
            <View className="flex-row items-center gap-3">
              <AppText
                accessibilityRole="header"
                weight="bold"
                className="min-w-0 flex-1 text-xl text-text-primary"
              >
                Access notes
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close access notes"
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
            <MerchantAccessDirections
              directions={text}
              collapsible={false}
              presentation="sheet"
              className="mt-1"
            />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
