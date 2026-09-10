import type { ReactNode } from "react";
import { ActivityIndicator, TouchableOpacity } from "react-native";

import AppText, { type AppTextWeight } from "@/shared/components/AppText";

type ButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  fontClassName?: string;
  textWeight?: AppTextWeight;
  variant?: "primary" | "secondary" | "outline" | "soft" | "danger" | "success";
  rounded?: "none" | "sm" | "md" | "lg" | "full";
};

/**
 * Provides a reusable application button for common user actions.
 *
 * Supports visual variants, Nunito Sans text weights, loading states,
 * optional icons, disabled states, and configurable corner radius.
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  className = "",
  variant = "primary",
  fontClassName = "text-base",
  textWeight = "semibold",
  rounded = "lg",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantClass = {
    primary: "bg-brand",
    secondary: "bg-surface",
    outline: "border border-border-primary bg-white",
    soft: "border border-brand bg-white",
    danger: "bg-red-500",
    success: "bg-green-500",
  }[variant];

  const textColorClass = {
    primary: "text-white",
    secondary: "text-text-primary",
    outline: "text-text-primary",
    soft: "text-brand",
    danger: "text-white",
    success: "text-white",
  }[variant];

  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  }[rounded];

  const loadingIndicatorColor = {
    primary: "#FFFFFF",
    secondary: "#1A1A1A",
    outline: "#1A1A1A",
    soft: "#F27F0D",
    danger: "#FFFFFF",
    success: "#FFFFFF",
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      className={`cursor-pointer flex-row items-center justify-center px-4 py-4 ${
        isDisabled ? "opacity-50" : ""
      } ${roundedClass} ${variantClass} ${className}`}
    >
      {/* Button content */}
      {loading ? (
        <ActivityIndicator color={loadingIndicatorColor} />
      ) : (
        <>
          {icon}

          <AppText
            weight={textWeight}
            numberOfLines={1}
            className={`${fontClassName} ${textColorClass} ${
              icon ? "ml-2" : ""
            }`}
          >
            {title}
          </AppText>
        </>
      )}
    </TouchableOpacity>
  );
}
