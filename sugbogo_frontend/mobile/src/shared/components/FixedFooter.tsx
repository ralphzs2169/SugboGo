import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Pins content to the bottom of the screen above the safe area, with a
 * consistent top border, background, and horizontal/top padding. Used for
 * screen-level action bars (e.g. review composer actions, business
 * management CTA) that must stay visible above scrollable content.
 */
export default function FixedFooter({ children, className = "" }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`absolute bottom-0 left-0 right-0 border-t border-border-primary bg-surface px-4 pt-3 ${className}`}
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {children}
    </View>
  );
}
