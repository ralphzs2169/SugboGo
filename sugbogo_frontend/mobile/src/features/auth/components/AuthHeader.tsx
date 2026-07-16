import SugboGoLogo from "@/shared/components/SugboGoLogo";
import { Text, View } from "react-native";
import BrandLogo from "@/shared/components/BrandLogo";
interface AuthHeaderProps {
  subtitle?: string;
}

export default function AuthHeader({
  subtitle = "Discover the Hidden Gems of Cebu.",
}: AuthHeaderProps) {
  return (
    <View className="mb-14 items-center">
      <BrandLogo />
      <Text className="text-body text-[11.5px] text-text-secondary">
        {subtitle}
      </Text>
    </View>
  );
}
