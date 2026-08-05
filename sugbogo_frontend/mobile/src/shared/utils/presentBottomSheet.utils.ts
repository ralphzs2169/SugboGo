import { RefObject } from "react";
import { Keyboard } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

/**
 * Dismisses the keyboard before presenting a bottom sheet.
 *
 * The sheet presentation is deferred until the next animation frame so
 * the keyboard has time to begin dismissing before the sheet appears.
 * This prevents the bottom sheet from being presented behind the keyboard.

 */
export function presentBottomSheet(
  sheetRef: RefObject<BottomSheetModal | null>,
) {
  Keyboard.dismiss();

  requestAnimationFrame(() => {
    sheetRef.current?.present();
  });
}
