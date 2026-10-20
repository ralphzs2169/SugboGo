import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  icon?: ComponentProps<typeof MaterialCommunityIcons>["name"];
  showSelectedCheck?: boolean;
  accessibilityLabel?: string;
  /** Optional series identity; keeps labels and surfaces neutral. */
  accentColor?: string;
  compact?: boolean;
};

/**
 * Displays a reusable selectable filter chip.
 *
 * Uses neutral surface states for selection and optionally shows an icon,
 * supporting count, or checkmark when the filter is selected.
 */
export default function FilterChip({
  label,
  selected,
  onPress,
  count,
  icon,
  showSelectedCheck = false,
  accessibilityLabel,
  accentColor,
  compact = false,
}: Props) {
  const showCount = count !== undefined && count > 0;

  return (
    <SafePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={
        accentColor
          ? {
              borderWidth: 1,
              borderColor: selected ? `${accentColor}40` : "transparent",
              minHeight: compact ? 32 : 44,
              maxWidth: "100%",
            }
          : undefined
      }
      className={`cursor-pointer flex-row items-center rounded-full ${compact ? "px-2.5 py-1.5" : "px-4 py-2"} ${
        selected && !accentColor
          ? "bg-surface-muted-strong"
          : "bg-surface-muted"
      }`}
    >
      {/* Selected-state indicator */}
      {selected && showSelectedCheck && (
        <MaterialCommunityIcons
          name="check"
          size={15}
          color={
            accentColor && selected
              ? accentColor
              : theme.extends.colors.text.primary
          }
          style={{ marginRight: 5 }}
        />
      )}

      {/* Optional filter icon */}
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={14}
          color={
            accentColor && selected
              ? accentColor
              : theme.extends.colors.text.primary
          }
          style={{ marginRight: 5 }}
        />
      )}

      {/* Filter label and optional count */}
      <AppText
        weight="medium"
        className={`min-w-0 shrink ${compact ? "text-xs" : "text-sm"} ${
          selected ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {label}

        {showCount && (
          <AppText className="text-sm text-text-secondary">
            {` (${count})`}
          </AppText>
        )}
      </AppText>
    </SafePressable>
  );
}
