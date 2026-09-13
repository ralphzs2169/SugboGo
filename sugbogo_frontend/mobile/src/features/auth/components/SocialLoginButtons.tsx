import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import GoogleIcon from "@/shared/components/icons/GoogleIcon";

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onGooglePress?: () => void;
  onFacebookPress?: () => void;
}

/**
 * Renders Google and Facebook authentication actions side by side using
 * consistent secondary styling beneath the primary credential login action.
 */
export default function SocialLoginButtons({
  disabled = false,
  onGooglePress,
  onFacebookPress,
}: SocialLoginButtonsProps) {
  return (
    <View className="flex-row gap-3">
      {/* Google authentication */}
      <Pressable
        disabled={disabled}
        onPress={onGooglePress}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        className={`h-12 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:opacity-75 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <View className="mr-2 h-4 w-4 items-center justify-center">
          <GoogleIcon />
        </View>

        <AppText
          weight="semibold"
          className="text-sm text-text-primary"
          numberOfLines={1}
        >
          Google
        </AppText>
      </Pressable>

      {/* Facebook authentication */}
      <Pressable
        disabled={disabled}
        onPress={onFacebookPress}
        accessibilityRole="button"
        accessibilityLabel="Continue with Facebook"
        className={`h-12 flex-1 cursor-pointer flex-row items-center justify-center rounded-xl border border-border-primary bg-surface px-3 active:opacity-75 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <Ionicons
          name="logo-facebook"
          size={21}
          color="#1877F2"
          style={{ marginRight: 8 }}
        />

        <AppText
          weight="semibold"
          className="text-sm text-text-primary"
          numberOfLines={1}
        >
          Facebook
        </AppText>
      </Pressable>
    </View>
  );
}
