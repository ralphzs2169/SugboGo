import { ActivityIndicator, Text, View } from "react-native";

/**
 * SigningInOverlay component displays a full-screen overlay with a loading indicator and a message.
 * It is typically used after a redirect from a social login provider
 */
export default function SigningInOverlay() {
  return (
    <View
      className="absolute inset-0 items-center justify-center bg-white"
      style={{ zIndex: 999 }}
    >
      <ActivityIndicator size="large" color="#F27F0D" />

      <Text className="mt-4 text-base font-semibold">Signing you in...</Text>
    </View>
  );
}
