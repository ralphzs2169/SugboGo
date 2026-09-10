import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

const MASCOT_GREETING = require("@/shared/assets/mascot/mascot-greeting.webp");

type CategoryIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type Category = {
  label: string;
  icon: CategoryIconName | null;
};

const CATEGORIES: Category[] = [
  { label: "All", icon: null },
  { label: "Culinary", icon: "silverware-fork-knife" },
  { label: "Leisure", icon: "surfing" },
  { label: "Creative", icon: "palette-outline" },
];

type Props = {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onPressFilters: () => void;
  activeFilterCount?: number;
};

/**
 * Displays the Explore screen's primary discovery controls.
 *
 * Presents the current exploration context alongside search, filtering,
 * quick category navigation, and compact SugboGo mascot branding.
 */
export default function ExploreTopBar({
  selectedCategory,
  onSelectCategory,
  onPressFilters,
  activeFilterCount = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Exploration context */}
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-1">
          <AppText weight="extrabold" className="text-2xl text-text-primary">
            Explore{" "}
            <AppText weight="extrabold" className="text-2xl text-brand">
              Cebu
            </AppText>
          </AppText>

          <View className="mt-1 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={15}
              color={theme.extends.colors.text.secondary}
            />

            <AppText
              weight="medium"
              className="ml-1 text-sm text-text-secondary"
            >
              Cebu City, Cebu
            </AppText>
          </View>
        </View>

        {/* Mascot branding */}
        <View className="ml-3 h-11 w-11 items-center justify-center">
          <Image
            source={MASCOT_GREETING}
            style={{ width: 44, height: 44 }}
            contentFit="contain"
          />
        </View>
      </View>

      {/* Search and filtering */}
      <View className="mb-3 flex-row gap-2">
        <View className="flex-1 flex-row items-center rounded-input border border-border-primary bg-background px-3.5">
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={theme.extends.colors.text.tertiary}
          />

          <TextInput
            className="ml-2 flex-1 py-3 text-sm text-text-primary"
            style={{
              fontFamily: "NunitoSans_400Regular",
            }}
            placeholder="Search businesses or places..."
            placeholderTextColor={theme.extends.colors.text.tertiary}
            returnKeyType="search"
            accessibilityLabel="Search businesses or places"
          />
        </View>

        <Pressable
          onPress={onPressFilters}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Open discovery filters"
          className="relative cursor-pointer items-center justify-center rounded-input border border-border-primary bg-background px-3.5 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={22}
            color={theme.extends.colors.text.secondary}
          />

          {activeFilterCount > 0 && (
            <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
              <AppText
                weight="bold"
                className="text-[10px] leading-4 text-white"
              >
                {activeFilterCount}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Quick discovery categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-none"
        contentContainerClassName="gap-2"
      >
        {CATEGORIES.map((category) => {
          const isActive = category.label === selectedCategory;

          return (
            <Pressable
              key={category.label}
              onPress={() => onSelectCategory(category.label)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className={`cursor-pointer flex-row items-center rounded-full px-4 py-2 ${
                isActive ? "bg-brand" : "bg-background"
              }`}
            >
              {category.icon && (
                <MaterialCommunityIcons
                  name={category.icon}
                  size={14}
                  color={
                    isActive ? "#FFFFFF" : theme.extends.colors.text.secondary
                  }
                  style={{ marginRight: 5 }}
                />
              )}

              <AppText
                weight="medium"
                className={`text-sm ${
                  isActive ? "text-white" : "text-text-secondary"
                }`}
              >
                {category.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
