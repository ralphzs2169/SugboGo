import { View, useWindowDimensions } from "react-native";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
import SegmentedControl from "@/shared/components/SegmentedControl";

/** Wraps analytics controls at large text sizes with explicit selected semantics. */
export default function AnalyticsChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  segmented = false,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  segmented?: boolean;
}) {
  const { fontScale } = useWindowDimensions();

  return (
    <View className="gap-2">
      <AppText weight="semibold" className="text-sm text-text-secondary">
        {label}
      </AppText>
      {/* Shared controls keep analytics selections consistent with the rest of the app. */}
      {segmented ? (
        <View style={{ width: 160 * Math.max(1, fontScale), maxWidth: "100%" }}>
          <SegmentedControl
            options={options.map((option) => ({
              ...option,
              accessibilityLabel: `${label}: ${option.label}`,
            }))}
            value={value}
            onChange={onChange}
            variant="sm"
          />
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {options.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(option.value)}
              accessibilityLabel={`${label}: ${option.label}`}
              showSelectedCheck
            />
          ))}
        </View>
      )}
    </View>
  );
}
