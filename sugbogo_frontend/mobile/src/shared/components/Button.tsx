import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type GestureResponderEvent,
} from "react-native";
import type { ReactNode } from "react";

type ButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  fontClassName?: string;
  variant?: "primary" | "secondary" | "danger";
};

/**
 * Button component provides a customizable button for various actions.
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  icon,
  className = "",
  variant = "primary",
  fontClassName = "text-base font-semibold",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantClass = {
    primary: "bg-brand",
    secondary: "bg-surface",
    danger: "bg-red-500",
  }[variant];

  const textColorClass = {
    primary: "text-white",
    secondary: "text-text-primary",
    danger: "text-white",
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-lg px-4 py-4  ${
        isDisabled ? "opacity-50" : ""
      } ${variantClass} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          {icon}

          <Text
            className={`${fontClassName}  ${textColorClass} ${
              icon ? "ml-2" : ""
            }`}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
