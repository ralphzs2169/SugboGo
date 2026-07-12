import { Image, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SocialLoginButtonsProps {
  onGooglePress?: () => void;
  onFacebookPress?: () => void;
  onApplePress?: () => void;
}

/**
 * SocialLoginButtons component provides buttons for social login options (Google, Facebook, Apple).
 * @param {Function} onGooglePress - Function to handle the press event for the Google login button.
 * @param {Function} onFacebookPress - Function to handle the press event for the Facebook login button.
 * @param {Function} onApplePress - Function to handle the press event for the Apple login button.
 */
export default function SocialLoginButtons({
  onGooglePress,
  onFacebookPress,
  onApplePress,
}: SocialLoginButtonsProps) {
  return (
    <View className="flex-row justify-center">
      <TouchableOpacity
        onPress={onGooglePress}
        accessibilityLabel="Continue with Google"
        className="mr-4 h-[52px] w-[52px] items-center justify-center rounded-full border border-gray-200 bg-white"
      >
        <Image
          source={require("../../../icons/google-logo.png")}
          style={{
            width: 26,
            height: 26,
            resizeMode: "contain",
          }}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onFacebookPress}
        className="mr-4 h-[52px] w-[52px] items-center justify-center rounded-full border border-[#1877F2] bg-[#1877F2]"
      >
        <Ionicons name="logo-facebook" size={24} color="white" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onApplePress}
        className="h-[52px] w-[52px] items-center justify-center rounded-full border border-black bg-black"
      >
        <Ionicons name="logo-apple" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}
