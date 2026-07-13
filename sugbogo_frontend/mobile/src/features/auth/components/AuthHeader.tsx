import SugboGoLogo from "@/shared/components/SugboGoLogo";
import { Text, View } from "react-native";
interface AuthHeaderProps {
  subtitle?: string;
}

export default function AuthHeader({
  subtitle = "Discover the Hidden Gems of Cebu.",
}: AuthHeaderProps) {
  return (
    <View className="mb-6 items-center">
      <SugboGoLogo />

      <Text className="mt-1 text-body text-muted">{subtitle}</Text>
    </View>
  );
}
