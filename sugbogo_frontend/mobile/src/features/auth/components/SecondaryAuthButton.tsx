import { ReactNode } from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";

interface SecondaryAuthButtonProps {
  title: string;
  onPress: () => void;
  icon?: ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export default function SecondaryAuthButton({
  title,
  onPress,
  icon,
  className = "",
  disabled = false,
  loading = false,
}: SecondaryAuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      className={`mb-20 mt-2 flex-row items-center justify-center rounded-lg border border-brand px-4 py-4 ${
        isDisabled ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text className="font-semibold text-brand">{title}</Text>

          {icon}
        </>
      )}
    </TouchableOpacity>
  );
}
