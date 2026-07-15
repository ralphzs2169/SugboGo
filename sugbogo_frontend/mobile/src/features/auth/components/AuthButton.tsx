import { ReactNode } from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * AuthButton component provides a customizable button for authentication actions.
 *
 * @param {string} title - The text displayed on the button.
 * @param {() => void} onPress - The function to call when the button is pressed.
 * @param {ReactNode} icon - An optional icon displayed beside the button text.
 * @param {string} className - Additional CSS classes for customization.
 * @param {boolean} disabled - Whether the button is disabled.
 * @param {boolean} loading - Whether the button is processing an async action.
 */
export default function AuthButton({
  title,
  onPress,
  icon,
  className = "",
  disabled = false,
  loading = false,
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`mb-20 mt-2 flex-row items-center justify-center shadow rounded-lg bg-brand px-4 py-4 ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          <Text className="mr-2 text-md font-bold text-white">{title}</Text>

          {icon}
        </>
      )}
    </TouchableOpacity>
  );
}
