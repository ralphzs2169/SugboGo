import { ReactNode, useState } from "react";
import { TextInput, TextInputProps, TouchableOpacity } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import InputContainer from "./InputContainer";

interface PasswordInputProps extends TextInputProps {
  label: string;
  rightElement?: ReactNode;
  error?: string;
}

/**
 * PasswordInput renders a password field with a visibility toggle
 * inside a reusable InputContainer.
 */
export default function PasswordInput({
  label,
  rightElement,
  error,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputContainer label={label} error={error} rightElement={rightElement}>
      <TextInput
        className="flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor="#999999"
        secureTextEntry={!showPassword}
        {...props}
      />

      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
        <Ionicons
          name={showPassword ? "eye-outline" : "eye-off-outline"}
          size={18}
          color="#999999"
        />
      </TouchableOpacity>
    </InputContainer>
  );
}
