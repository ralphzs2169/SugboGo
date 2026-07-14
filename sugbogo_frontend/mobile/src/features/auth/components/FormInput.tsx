import { ReactNode } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

interface FormInputProps extends TextInputProps {
  label: string;
  rightElement?: ReactNode;
}

/**
 * FormInput component provides a labeled text input field.
 * @param {string} label - The label text displayed above the input field.
 * @param {ReactNode} rightElement - An optional element on the right side of the label.
 * @param {TextInputProps} props - Additional props passed to the TextInput component.
 */
export default function FormInput({
  label,
  rightElement,
  ...props
}: FormInputProps) {
  return (
    <View className="mb-6">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-xs font-bold tracking-[0.5px] text-text-primary">
          {label}
        </Text>
        {rightElement}
      </View>

      <View className="flex-row items-center rounded-input border border-disabled bg-surface px-[14px]">
        <TextInput
          className="flex-1 py-[14px] text-body text-text-primary"
          placeholderTextColor="#999999" // matches your `placeholder` token
          {...props}
        />
      </View>
    </View>
  );
}
