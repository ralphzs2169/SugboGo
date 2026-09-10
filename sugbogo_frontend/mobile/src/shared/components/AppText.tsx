import type { ReactNode } from "react";
import { Text, type TextProps } from "react-native";

type AppTextWeight = "regular" | "medium" | "semibold" | "bold";

type AppTextProps = TextProps & {
  children?: ReactNode;
  className?: string;
  weight?: AppTextWeight;
};

const FONT_CLASSES: Record<AppTextWeight, string> = {
  regular: "font-nunito",
  medium: "font-nunito-medium",
  semibold: "font-nunito-semibold",
  bold: "font-nunito-bold",
};

/**
 * Renders application text using the Nunito Sans font family.
 *
 * Provides consistent access to supported font weights while preserving
 * the standard React Native Text API and NativeWind styling.
 */
export default function AppText({
  children,
  weight = "regular",
  className = "",
  ...props
}: AppTextProps) {
  return (
    // Application text
    <Text {...props} className={`${FONT_CLASSES[weight]} ${className}`}>
      {children}
    </Text>
  );
}
