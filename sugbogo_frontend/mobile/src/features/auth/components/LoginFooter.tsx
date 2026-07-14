import { View, Text, TouchableOpacity } from "react-native";

interface LoginFooterProps {
  onPressRegister: () => void;
}
/**
 * LoginFooter component provides a footer with a link to the registration page.
 * @param {Function} onPressRegister - Function to handle the press event for the registration link.
 */
export default function LoginFooter({ onPressRegister }: LoginFooterProps) {
  return (
    <View className="mt-6 flex-row items-center">
      <Text className="text-body text-muted">New to SugboGo? </Text>
      <TouchableOpacity onPress={onPressRegister}>
        <Text className="text-body font-bold text-brand">
          Create an account
        </Text>
      </TouchableOpacity>
    </View>
  );
}