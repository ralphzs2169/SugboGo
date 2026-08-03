import { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type ReviewSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  children?: ReactNode;
  showBorder?: boolean;
  isPageHeader?: boolean;
  onEdit?: () => void;
};

export default function ReviewSection({
  icon,
  title,
  description,
  children,
  showBorder = true,
  isPageHeader = false,
  onEdit,
}: ReviewSectionProps) {
  return (
    <View className={`mb-2 bg-surface px-6 pt-6 ${isPageHeader ? "" : "pb-4"}`}>
      <View className="mb-4">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name={icon}
            size={isPageHeader ? 24 : 22}
            color={theme.extends.colors.text.primary}
          />

          <Text
            className={`ml-2 flex-1 font-bold ${
              isPageHeader ? "text-2xl" : "text-md"
            } text-text-primary`}
          >
            {title}
          </Text>

          {onEdit && (
            <Pressable
              onPress={onEdit}
              hitSlop={8}
              className="flex-row items-center rounded-lg px-2 py-1"
            >
              <MaterialCommunityIcons
                name="pencil-outline"
                size={17}
                color={theme.extends.colors.brand}
              />

              <Text className="ml-1 text-sm font-semibold text-brand">
                Edit
              </Text>
            </Pressable>
          )}
        </View>

        {description && (
          <Text className="mt-2 text-sm leading-5 text-text-secondary">
            {description}
          </Text>
        )}
      </View>

      <View
        className={showBorder ? "border-t border-border-primary/60 pt-5" : ""}
      >
        {children}
      </View>
    </View>
  );
}
