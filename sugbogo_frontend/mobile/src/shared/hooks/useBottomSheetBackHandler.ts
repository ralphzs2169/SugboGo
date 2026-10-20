import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { BackHandler } from "react-native";

/** Gives an open sheet the first Android back press without popping its screen. */
export default function useBottomSheetBackHandler(
  sheetRef: RefObject<BottomSheetModal | null>,
) {
  const focused = useIsFocused();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focused || !open) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [focused, open, sheetRef]);

  const onChange = useCallback((index: number) => {
    if (index >= 0) setOpen(true);
  }, []);

  // Keep consuming back during the closing animation, until dismissal completes.
  const onDismiss = useCallback(() => setOpen(false), []);

  return { onChange, onDismiss };
}
