import type { ReactNode } from "react";

/** Models modal presentation/dismissal without native worklets in focused report tests. */
export function analyticsSheetMock() {
  const { useImperativeHandle, useState } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: View,
    BottomSheetModal: function MockModal({
      ref,
      children,
      onDismiss,
      onChange,
    }: {
      ref: unknown;
      children: ReactNode;
      onDismiss?: () => void;
      onChange?: (index: number) => void;
    }) {
      const [visible, setVisible] = useState(false);
      useImperativeHandle(ref, () => ({
        present: () => {
          setVisible(true);
          onChange?.(0);
        },
        dismiss: () => {
          setVisible(false);
          onDismiss?.();
        },
      }));
      return visible ? <View>{children}</View> : null;
    },
  };
}
