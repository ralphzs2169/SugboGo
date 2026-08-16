import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import InputContainer from "./InputContainer";
import { theme } from "@/constants/theme";

type FormSelectProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress: () => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rightElement?: React.ReactNode;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

/**
 * FormSelect renders a pressable selection field within an InputContainer.
 *
 * Used for fields that open a picker, bottom sheet, or modal instead of
 * accepting free-text input. An optional leading icon can represent the
 * selected option.
 */
export default function FormSelect({
  label,
  value,
  placeholder = "Select",
  onPress,
  error,
  disabled = false,
  required = false,
  rightElement,
  icon,
}: FormSelectProps) {
  return (
    <InputContainer
      label={label}
      error={error}
      rightElement={rightElement}
      required={required}
      editable={!disabled}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        className="flex-1 flex-row items-center justify-between py-[14px]"
      >
        <View className="flex-1 flex-row items-center gap-2">
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          )}

          <Text
            className={`text-body ${
              disabled
                ? "text-text-secondary"
                : value
                  ? "text-text-primary"
                  : "text-text-secondary"
            }`}
          >
            {value || placeholder}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={disabled ? "#D1D5DB" : "#999999"}
        />
      </Pressable>
    </InputContainer>
  );
}
