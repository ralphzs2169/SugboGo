import { View } from "react-native";
import LogoImage from "@/assets/images/sugbogo-logo.svg";

type LogoProps = {
  size?: number;
  className?: string;
};

export default function SugboGoLogo({ size = 50, className = "" }: LogoProps) {
  return (
    <View className={className}>
      <LogoImage width={size} height={size} />
    </View>
  );
}
