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
}: Props) {
  const showCount = count !== undefined && count > 0;

  return (
    <SafePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      className={`cursor-pointer flex-row items-center rounded-lg px-4 py-2 ${
        selected ? "bg-surface-muted-strong" : "bg-surface-muted"
      }`}
    >
      {/* Selected-state indicator */}
      {selected && showSelectedCheck && (
        <MaterialCommunityIcons
          name="check"
          size={15}
          color={theme.extends.colors.text.primary}
          style={{ marginRight: 5 }}
        />
      )}

      {/* Optional filter icon */}
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={14}
          color={theme.extends.colors.text.primary}
          style={{ marginRight: 5 }}
        />
      )}

      {/* Filter label and optional count */}
      <AppText weight="medium" className="text-sm text-text-primary">
        {label}

        <AppText className="text-sm text-text-secondary">
          {showCount ? ` (${count})` : ""}
        </AppText>
      </AppText>
    </SafePressable>
  );
}
