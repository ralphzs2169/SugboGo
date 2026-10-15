import { View, TextInput, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";

const FILTERS = [
  { label: "Near Me", icon: "crosshairs-gps" as const },
  { label: "Open Now", icon: "clock-outline" as const },
  { label: "Top Rated", icon: "star-outline" as const },
];

/** Preserves the discovery overlay while search and filters await backend support. */
export default function MapSearchOverlay() {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-0 right-0 top-0 px-screen-x"
      style={{ paddingTop: insets.top + 12 }}
    >
      {/* Search remains visibly unavailable until its API is implemented. */}
      <View
        className="flex-row items-center rounded-input bg-surface px-md py-sm"
        style={{ elevation: 4 }}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={theme.extends.colors.text.tertiary}
        />
        <TextInput
          className="ml-sm flex-1 text-body text-text-primary"
          placeholder="Search and filters coming soon"
          editable={false}
          accessibilityLabel="Business search coming soon"
          accessibilityState={{ disabled: true }}
          placeholderTextColor={theme.extends.colors.text.tertiary}
        />
        <Pressable
          hitSlop={8}
          disabled
          accessibilityRole="button"
          accessibilityLabel="Filters coming soon"
          accessibilityState={{ disabled: true }}
          className="opacity-50"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={theme.extends.colors.brand}
          />
        </Pressable>
      </View>

      {/* Preserve the existing chip layout without pretending to filter results. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-sm flex-none"
        contentContainerClassName="gap-sm"
      >
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.label}
            disabled
            accessibilityRole="button"
            accessibilityLabel={`${filter.label} filter coming soon`}
            accessibilityState={{ disabled: true }}
            className="flex-row items-center rounded-tag border border-text-primary bg-surface px-md py-sm opacity-50"
          >
            <MaterialCommunityIcons
              name={filter.icon}
              size={16}
              color={theme.extends.colors.text.primary}
            />
            <AppText
              weight="semibold"
              className="ml-xs text-small text-text-primary"
            >
              {filter.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
