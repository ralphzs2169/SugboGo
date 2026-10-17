import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

/** Wraps analytics controls at large text sizes with explicit selected semantics. */
export default function AnalyticsChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      <AppText weight="semibold" className="text-sm text-text-secondary">
        {label}
      </AppText>
      {/* Wrapping controls retain practical touch targets without horizontal truncation. */}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: value === option.value }}
            className={`min-h-12 justify-center rounded-full border px-4 py-2 active:opacity-70 ${
              value === option.value
                ? "border-brand bg-brand/10"
                : "border-border-primary bg-surface"
            }`}
          >
            <AppText
              weight={value === option.value ? "bold" : "medium"}
              className="text-sm text-text-primary"
            >
              {option.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
