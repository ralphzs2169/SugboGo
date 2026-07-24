import { Text, TextInput, type TextInputProps, View } from "react-native";

type ProfileTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

/**
 * A reusable text field component for profile forms.
 */
export default function ProfileTextField({
  label,
  error,
  ...props
}: ProfileTextFieldProps) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm text-text-secondary">{label}</Text>

      <TextInput
        {...props}
        className={`rounded-lg border bg-surface px-4 py-3 text-text-primary ${
          error ? "border-error" : "border-border"
        }`}
      />

      {error ? <Text className="mt-1 text-sm text-error">{error}</Text> : null}
    </View>
  );
}
