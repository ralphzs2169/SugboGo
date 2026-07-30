import { Pressable, Text, View } from "react-native";

type FormFieldApiErrorProps = {
  message: string;
  onRetry?: () => void;
};

/**
 * Displays an API error message for a form field, with an optional retry button.
 */
export default function FormFieldApiError({
  message,
  onRetry,
}: FormFieldApiErrorProps) {
  return (
    <View className="flex-row items-center">
      <Text className="text-sm text-red-500">{message}</Text>

      {onRetry && (
        <Pressable onPress={onRetry}>
          <Text className="ml-auto underline text-sm font-semibold text-brand">
            Retry
          </Text>
        </Pressable>
      )}
    </View>
  );
}
