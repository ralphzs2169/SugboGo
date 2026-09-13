import { View } from "react-native";
import SugboGoLogo from "@/shared/components/SugboGoLogo";
import AppText from "./AppText";

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

      <AppText className={` ${logoSize[size]}  tracking-[0.5px]`}>
        <AppText weight="extrabold" className="text-brand">
          Sugbo
        </AppText>
        <AppText weight="extrabold" className="text-text-primary">
          Go
        </AppText>
      </AppText>
    </View>
  );
}
