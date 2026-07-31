import { ReactNode } from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type RegistrationSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  children: ReactNode;
  showBorder?: boolean;
};

export default function RegistrationSection({
  icon,
  title,
  description,
  children,
  showBorder = true,
}: RegistrationSectionProps) {
  return (
    <View className="mb-2 bg-surface px-6 pt-6 pb-4">
      <View className="mb-4">
        <View className="flex-row items-center">
          {/* <MaterialCommunityIcons name={icon} size={22} color="#F27F0D" /> */}

          <Text className="text-2xl font-bold text-text-primary">{title}</Text>
        </View>

        {description && (
          <Text className="mt-2 text-sm leading-5 text-text-secondary">
            {description}
          </Text>
        )}
      </View>

      <View className={showBorder ? "border-t border-border/60 pt-5" : ""}>
        {children}
      </View>
    </View>
  );
}
