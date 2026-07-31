import { ReactNode } from "react";
import { Text, View } from "react-native";

interface InputContainerProps {
  label: string;
  error?: string;
  rightElement?: ReactNode;
  children: ReactNode;
  required?: boolean;
  editable?: boolean;
}

/**
 * InputContainer provides a reusable wrapper for form inputs.
 *
 * It renders:
 * - a field label
 * - an optional right-side element
 * - the input container
 * - an optional validation error
 * - an optional editable state
 */
export default function InputContainer({
  label,
  error,
  rightElement,
  children,
  required = false,
  editable = true,
}: InputContainerProps) {
  return (
    <View className="mb-5">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-xs font-bold tracking-[0.5px] text-text-secondary">
          {label}
          {required && <Text className="text-error"> *</Text>}
        </Text>

        {rightElement}
      </View>

      <View
        className={`flex-row items-center rounded-input border px-[14px] ${
          error
            ? "border-error bg-surface"
            : editable
              ? "border-disabled bg-surface"
              : "border-disabled bg-gray-100"
        }`}
      >
        {children}
      </View>

      {error ? (
        <Text className="mt-1 text-xs font-medium text-error">{error}</Text>
      ) : null}
    </View>
  );
}
