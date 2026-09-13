import { View } from "react-native";
import BrandLogo from "@/shared/components/BrandLogo";
import AppText from "@/shared/components/AppText";
interface AuthHeaderProps {
  subtitle?: string;
}

export default function AuthHeader({
  subtitle = "Discover the Hidden Gems of Cebu.",
}: AuthHeaderProps) {
  return (
    <View className="mb-14 items-center">
      <BrandLogo />
      <AppText className="text-body text-[11.5px] text-text-secondary">
        {subtitle}
      </AppText>
    </View>
  );
}
