import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWindowDimensions, View } from "react-native";

import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type MockSpecialty = {
  id: number;
  name: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  businessCount: number;
};

type Props = {
  onSpecialtyPress?: (specialtyId: number) => void;
};

const HORIZONTAL_PADDING = 16;
const COLUMN_GAP = 12;

const MOCK_SPECIALTIES: MockSpecialty[] = [
  {
    id: 1,
    name: "Local Coffee",
    icon: "coffee-outline",
    color: "#A66A3F",
    businessCount: 14,
  },
  {
    id: 2,
    name: "Desserts",
    icon: "cupcake",
    color: "#D96C91",
    businessCount: 9,
  },
  {
    id: 3,
    name: "Handmade Crafts",
    icon: "palette-outline",
    color: "#8B62C4",
    businessCount: 8,
  },
  {
    id: 4,
    name: "Cebuano Food",
    icon: "food-outline",
    color: "#D97706",
    businessCount: 16,
  },
  {
    id: 5,
    name: "Outdoor Dining",
    icon: "leaf",
    color: "#4D9468",
    businessCount: 11,
  },
  {
    id: 6,
    name: "Baked Goods",
    icon: "bread-slice-outline",
    color: "#C58B52",
    businessCount: 7,
  },
];

/**
 * Displays specialty shortcuts for quickly entering focused business discovery.
 *
 * The temporary mock grid previews how real Specialty Tags can provide a more
 * visual entry point into the existing search and filter results experience.
 */
export default function ExploreBySpecialtySection({ onSpecialtyPress }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const tileWidth = (screenWidth - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

  return (
    <View className="py-6">
      {/* Section introduction */}
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Explore by Specialty
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Find places based on what you&apos;re into.
        </AppText>
      </View>

      {/* Specialty shortcut grid */}
      <View className="flex-row flex-wrap gap-3 px-4">
        {MOCK_SPECIALTIES.map((specialty) => (
          <SafePressable
            key={specialty.id}
            onPress={() => onSpecialtyPress?.(specialty.id)}
            accessibilityRole="button"
            accessibilityLabel={`Explore ${specialty.name}`}
            style={{
              width: tileWidth,
            }}
            className="min-h-[104px] cursor-pointer justify-between rounded-card border border-border-primary bg-surface p-3.5 active:opacity-80"
            android_ripple={{
              color: `${specialty.color}12`,
            }}
          >
            {/* Specialty identity */}
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${specialty.color}18`,
              }}
            >
              <MaterialCommunityIcons
                name={specialty.icon}
                size={22}
                color={specialty.color}
              />
            </View>

            {/* Specialty details */}
            <View className="mt-3">
              <AppText
                weight="bold"
                className="text-sm leading-5 text-text-primary"
                numberOfLines={1}
              >
                {specialty.name}
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-tertiary">
                {specialty.businessCount}{" "}
                {specialty.businessCount === 1 ? "place" : "places"}
              </AppText>
            </View>
          </SafePressable>
        ))}
      </View>
    </View>
  );
}
