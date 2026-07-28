import { ReactNode } from "react";
import { Text, View } from "react-native";

interface InputContainerProps {
  label: string;
  error?: string;
  rightElement?: ReactNode;
  children: ReactNode;
  required?: boolean;
}

/**
 * InputContainer provides a reusable wrapper for form inputs.
 *
 * It renders:
 * - a field label
 * - an optional right-side element
 * - the input container
 * - an optional validation error
 */
export default function InputContainer({
  label,
  error,
  rightElement,
  children,
  required = false,
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
        className={`flex-row items-center rounded-input border bg-surface px-[14px] ${
          error ? "border-error " : "border-disabled"
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
