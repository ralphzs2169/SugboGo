import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

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
      <AppText className="flex-1 text-sm text-text-error">{message}</AppText>

      {onRetry && (
        <Pressable onPress={onRetry} hitSlop={8} className="ml-3">
          <AppText weight="semibold" className="text-sm  text-brand underline">
            Retry
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
