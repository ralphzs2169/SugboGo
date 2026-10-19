import { ReactNode, useState } from "react";
import { TextInput, TextInputProps, TouchableOpacity } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

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
  editable = true,
  accessibilityLabel,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      editable={editable}
    >
      <TextInput
        className="flex-1 py-[14px] text-body text-text-primary"
        placeholderTextColor={theme.extends.colors.text.tertiary}
        secureTextEntry={!showPassword}
        accessibilityLabel={accessibilityLabel ?? label}
        editable={editable}
        {...props}
      />

      <TouchableOpacity
        onPress={() => setShowPassword(!showPassword)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${showPassword ? "Hide" : "Show"} ${accessibilityLabel ?? label}`}
        accessibilityState={{ disabled: !editable }}
        className="min-h-12 min-w-12 cursor-pointer items-center justify-center"
      >
        <Ionicons
          name={showPassword ? "eye-outline" : "eye-off-outline"}
          size={18}
          color={theme.extends.colors.text.tertiary}
        />
      </TouchableOpacity>
    </InputContainer>
  );
}
