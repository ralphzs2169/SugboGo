import GoogleIcon from "@/shared/components/icons/GoogleIcon";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onGooglePress?: () => void;
  onFacebookPress?: () => void;
  onApplePress?: () => void;
}

/**
 * Renders social login buttons for Google, Facebook, and Apple.
 *
 * The buttons are styled as circular icons and can be disabled during loading states.
 * Each button triggers its respective login handler when pressed.
 */
export default function SocialLoginButtons({
  onGooglePress,
  disabled,
  onFacebookPress,
  onApplePress,
}: SocialLoginButtonsProps) {
  return (
    <View className="flex-row justify-center  mb-8">
      <TouchableOpacity
        disabled={disabled}
        onPress={onGooglePress}
        accessibilityLabel="Continue with Google"
        className="mr-4 h-[52px] w-[52px] items-center justify-center rounded-full border border-gray-200 bg-white"
      >
        <GoogleIcon />
      </TouchableOpacity>

      <TouchableOpacity
        disabled={disabled}
        onPress={onFacebookPress}
        className="mr-4 h-[52px] w-[52px] items-center justify-center rounded-full border border-[#1877F2] bg-[#1877F2]"
      >
        <Ionicons name="logo-facebook" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        disabled={disabled}
        onPress={onApplePress}
        className="h-[52px] w-[52px] items-center justify-center rounded-full border border-black bg-black"
      >
        <Ionicons name="logo-apple" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}
