import { Pressable, Text, View } from "react-native";

type FormFieldApiErrorProps = {
  message: string;
  onRetry?: () => void;
};

/**
 * Displays an API error message for a form field, with an optional retry action.
 */
export default function FormFieldApiError({
  message,
  onRetry,
}: FormFieldApiErrorProps) {
  return (
    <View className="mt-2 flex-row items-start justify-between">
      <Text className="flex-1 text-sm text-text-error">{message}</Text>

      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8} className="ml-3">
          <Text className="text-sm font-semibold text-brand underline">
            Retry
          </Text>
        </Pressable>
      )}
    </View>
  );
}
