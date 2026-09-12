import { ReactNode } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type RegistrationSectionProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  children: ReactNode;
  showBorder?: boolean;
};

/**
 * Groups related merchant registration fields into a clearly labeled section.
 *
 * Displays section context at the top and optionally separates the form
 * content with a subtle divider.
 */
export default function RegistrationSection({
  icon,
  title,
  description,
  children,
  showBorder = true,
}: RegistrationSectionProps) {
  return (
    <View className="mb-2 bg-surface px-6 pb-4 pt-6">
      {/* Section heading */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between gap-4">
          <AppText
            weight="bold"
            className="min-w-0 flex-1 text-md text-text-primary"
          >
            {title}
          </AppText>

          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        {description && (
          <AppText className="mt-2 text-sm leading-5 text-text-secondary">
            {description}
          </AppText>
        )}
      </View>

      {/* Section content */}
      <View
        className={showBorder ? "border-t border-border-primary/60 pt-5" : ""}
      >
        {children}
      </View>
    </View>
  );
}
