import { ReactNode } from "react";
import { Text, TouchableOpacity } from "react-native";

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * AuthButton component provides a customizable button for authentication actions.
 * @param {string} title - The text displayed on the button.
 * @param {() => void} onPress - The function to call when the button is pressed.
 * @param {ReactNode} icon - An optional icon to display on the button.
 * @param {string} className - Additional CSS classes for the button.
 * @param {boolean} disabled - Whether the button is disabled.
 */
export default function AuthButton({
  title,
  onPress,
  icon,
  className = "",
  disabled = false,
}: AuthButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`mb-8 mt-2 flex-row items-center justify-center rounded-lg bg-[#F27F0D] px-4 py-4 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      <Text className="mr-2 text-[16px] font-bold text-white">{title}</Text>

      {icon}
    </TouchableOpacity>
  );
}
