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
      <Text className="text-logo mt-2 text-[32px] font-bold tracking-[0.5px]">
        <Text className="text-brand">Sugbo</Text>
        <Text className="text-text-primary">Go</Text>
      </Text>
      <Text className="text-body text-text-secondary">{subtitle}</Text>
    </View>
  );
}
