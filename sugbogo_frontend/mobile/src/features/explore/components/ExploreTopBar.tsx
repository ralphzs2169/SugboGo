import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

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
};

/**
 * Displays the primary Explore navigation and discovery controls.
 *
 * Establishes Cebu as the current exploration context and provides search
 * and category controls without competing with the discovery content below.
 */
export default function ExploreTopBar({
  selectedCategory,
  onSelectCategory,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-surface px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Explore context */}
      <View className="mb-4 flex-row items-start justify-between">
        <View>
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
              className="ml-1 text-sm  text-text-secondary"
            >
              Cebu City, Cebu
            </AppText>
          </View>
        </View>

        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          className="cursor-pointer items-center justify-center rounded-full bg-background p-2.5 active:opacity-70"
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>

      {/* Business search */}
      <View className="mb-3 flex-row items-center rounded-input border border-border-primary bg-background px-3.5 py-1">
        <MaterialCommunityIcons
          name="magnify"
          size={26}
          color={theme.extends.colors.text.tertiary}
        />

        <TextInput
          className="ml-2 flex-1 text-sm text-text-primary"
          style={{
            fontFamily: "NunitoSans_400Regular",
          }}
          placeholder="Search businesses or places..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
          returnKeyType="search"
          accessibilityLabel="Search businesses or places"
        />
      </View>

      {/* Discovery categories */}
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
              className={`cursor-pointer flex-row items-center rounded-full  px-4 py-2 ${
                isActive
                  ? "border-brand bg-brand"
                  : "border-border bg-background"
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
                className={`text-sm font-medium ${
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
