import { View, Text } from "react-native";
import SugboGoLogo from "@/shared/components/SugboGoLogo";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
}

export default function BrandLogo({ size = "md" }: BrandLogoProps) {
  const logoSize = {
    sm: "text-[20px]",
    md: "text-[28px]",
    lg: "text-[36px]",
  };

  return (
    <View className="flex-row justify-center items-center">
      <SugboGoLogo />

      <Text
        className={`text-logo ${logoSize[size]} font-bold tracking-[0.5px]`}
      >
        <Text className="text-brand">Sugbo</Text>
        <Text className="text-text-primary">Go</Text>
      </Text>
    </View>
  );
}
