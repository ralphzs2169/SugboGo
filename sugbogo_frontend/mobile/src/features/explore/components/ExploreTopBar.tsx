import { View, TextInput, Pressable, ScrollView, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";
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

export default function ExploreTopBar({ selectedCategory, onSelectCategory }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-surface px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold tracking-[0.5px]">
        <Text className="text-brand">Sugbo</Text>
        <Text className="text-text-primary">Go</Text>
        </Text>
        <Pressable hitSlop={12}>
          <MaterialCommunityIcons
            name="bell-outline"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>

      <View className="flex-row items-center rounded-input bg-background px-3 py-2 mb-3">
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={theme.extends.colors.text.tertiary}
        />
        <TextInput
          className="ml-2 flex-1 text-sm text-text-primary"
          placeholder="Find the best of Cebu..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
        />
      </View>

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
  className={`flex-row items-center rounded-full px-4 py-2 ${
    isActive ? "bg-brand" : "bg-background border border-border"
  }`}
>
  {category.icon && (
    <MaterialCommunityIcons
      name={category.icon}
      size={14}
      color={isActive ? "#FFFFFF" : theme.extends.colors.text.secondary}
      style={{ marginRight: 4 }}s
    />
  )}
  <Text
    className={`text-sm font-medium ${
      isActive ? "text-white" : "text-text-secondary"
    }`}
  >
    {category.label}
  </Text>
</Pressable>
            
          );
        })}
      </ScrollView>
    </View>
  );
}