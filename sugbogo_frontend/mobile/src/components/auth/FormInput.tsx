import { ReactNode, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

interface PasswordInputProps extends TextInputProps {
  label: string;
  rightElement?: ReactNode;
}

/**
 * PasswordInput component provides a labeled password input field with an optional right element.
 * @param {string} label - The label text displayed above the input field.
 * @param {ReactNode} rightElement - An optional element to display on the right side of the input field. ("Forgot Password?" link)
 * @param {TextInputProps} props - Additional props passed to the TextInput component.
 */
export default function PasswordInput({
  label,
  rightElement,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="mb-6">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] font-bold tracking-[0.5px] text-[#444]">
          {label}
        </Text>

        {rightElement}
      </View>

      <View className="flex-row items-center rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-[14px]">
        <TextInput
          className="flex-1 py-[14px] text-[14px] text-[#333]"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          {...props}
        />
      </View>
    </View>
  );
}
