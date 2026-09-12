import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

export type AppliedFilterItem = {
  id: string;
  label: string;
  onRemove: () => void;
};

type Props = {
  label: string;
  onRemove: () => void;
};

/**
 * Displays a removable filter chip used across Explore result surfaces.
 *
 * Keeps applied-filter styling, accessibility, and removal behavior consistent
 * between discovery results and collection screens.
 */
export default function AppliedFilterChip({ label, onRemove }: Props) {
  return (
    <SafePressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} filter`}
      className="min-h-10 cursor-pointer flex-row items-center rounded-full border border-border-primary bg-surface px-3 active:opacity-70"
    >
      {/* Filter label */}
      <AppText weight="semibold" className="text-xs text-text-secondary">
        {label}
      </AppText>

      {/* Remove control */}
      <MaterialCommunityIcons
        name="close"
        size={16}
        color={theme.extends.colors.text.secondary}
        style={{ marginLeft: 5 }}
      />
    </SafePressable>
  );
}
