import { View, TextInput, Pressable, Text, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FILTERS = [
  { label: "Near Me", icon: "crosshairs-gps" as const },
  { label: "Open Now", icon: "clock-outline" as const },
  { label: "Top Rated", icon: "star-outline" as const },
];

type Props = {
  activeFilters: string[];
  onToggleFilter: (label: string) => void;
};


export default function MapSearchOverlay({ activeFilters, onToggleFilter }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View 
    className="absolute left-0 right-0 top-0 px-screen-x"
    style={{ paddingTop: insets.top + 12 }}
>
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
          placeholder="Find hidden gems near you..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
        />
        <Pressable hitSlop={8}>
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={theme.extends.colors.brand}
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-sm flex-none"
        contentContainerClassName="gap-sm"
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilters.includes(filter.label);
          return (
            <Pressable
              key={filter.label}
              onPress={() => onToggleFilter(filter.label)}
              className={`flex-row items-center rounded-tag px-md py-sm ${
                isActive
                  ? "bg-brand"
                  : "bg-surface border border-text-primary"
              }`}
            >
              <MaterialCommunityIcons
                name={filter.icon}
                size={16}
                color={isActive ? "#FFFFFF" : theme.extends.colors.text.primary}
              />
              <Text
                className={`ml-xs text-small font-medium ${
                  isActive ? "text-white" : "text-text-primary"
                }`}
              >
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}