import { ReactNode, useState } from "react";
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

interface PasswordInputProps extends TextInputProps {
  label: string;
  rightElement?: ReactNode;
}

/**
 * PasswordInput component provides a labeled password input field with an optional right element.
 * @param {string} label - The label text displayed above the input field.
 * @param {ReactNode} rightElement - An optional element to display on the right side of the input field.
 * @param {TextInputProps} props - Additional props passed to the TextInput component.
 */
export default function PasswordInput({
  label,
  rightElement,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="mb-4">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-xs font-bold tracking-[0.5px] text-text-primary">
          {label}
        </Text>

        {rightElement}
      </View>

      <View className="flex-row items-center rounded-input border border-disabled bg-surface px-[14px]">
        <TextInput
          className="flex-1 py-[14px] text-body text-text-primary"
          placeholderTextColor="#999999" // matches `placeholder` token
          secureTextEntry={!showPassword}
          {...props}
        />

        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={18}
            color="#999999" // matches `placeholder` token
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
