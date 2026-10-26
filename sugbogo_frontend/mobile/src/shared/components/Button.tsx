import type { ReactNode } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

import AppText, { type AppTextWeight } from "@/shared/components/AppText";
import { theme } from "@/constants/theme";

type ButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
  fontClassName?: string;
  textWeight?: AppTextWeight;
  variant?: "primary" | "secondary" | "outline" | "soft" | "danger" | "success";
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  size?: "sm" | "md";
  accessibilityLabel?: string;
  /** Opts into the existing primary text token without changing variant defaults. */
  textTone?: "default" | "primary";
};

/**
 * Provides a reusable application button for common user actions.
 *
 * Supports visual variants, sizing, Nunito Sans text weights, loading states,
 * optional leading or trailing icons, and disabled states.
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  className = "",
  variant = "primary",
  fontClassName,
  textWeight = "semibold",
  rounded = "lg",
  size = "md",
  accessibilityLabel,
  textTone = "default",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantClass = {
    primary: "bg-brand",
    secondary: "bg-brand/70",
    outline: "border border-border-primary bg-white",
    soft: "border border-brand bg-white",
    danger: "bg-red-500",
    success: "bg-green-500",
  }[variant];

  const variantTextColorClass = {
    primary: "text-white",
    secondary: "text-white",
    outline: "text-text-primary",
    soft: "text-brand",
    danger: "text-white",
    success: "text-white",
  }[variant];
  const textColorClass =
    textTone === "primary" ? "text-text-primary" : variantTextColorClass;

  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  }[rounded];

  const sizeClass = {
    sm: "px-3 py-2.5",
    md: "px-4 py-4",
  }[size];

  const defaultFontClass = {
    sm: "text-sm",
    md: "text-base",
  }[size];

  const variantLoadingIndicatorColor = {
    primary: "#FFFFFF",
    secondary: "#1A1A1A",
    outline: "#1A1A1A",
    soft: "#F27F0D",
    danger: "#FFFFFF",
    success: "#FFFFFF",
  }[variant];
  const loadingIndicatorColor =
    textTone === "primary"
      ? theme.extends.colors.text.primary
      : variantLoadingIndicatorColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      className={`cursor-pointer flex-row items-center justify-center ${
        isDisabled ? "opacity-50" : ""
      } ${sizeClass} ${roundedClass} ${variantClass} ${className}`}
    >
      {/* Button content */}
      {loading ? (
        <ActivityIndicator color={loadingIndicatorColor} />
      ) : (
        <>
          {icon && iconPosition === "left" && icon}

          <AppText
            weight={textWeight}
            numberOfLines={1}
            className={`${fontClassName ?? defaultFontClass} ${textColorClass} ${
              icon && iconPosition === "left" ? "ml-2" : ""
            }`}
          >
            {title}
          </AppText>

          {icon && iconPosition === "right" && (
            <View className="ml-2">{icon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}
