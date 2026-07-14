import { Image } from "react-native";

import LogoImage from "@/assets/images/sugbogo-logo-small.png";

type LogoProps = {
  size?: number;
  className?: string;
};

export default function SugboGoLogo({ size = 60, className = "" }: LogoProps) {
  return (
    <Image
      source={LogoImage}
      className={className}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
