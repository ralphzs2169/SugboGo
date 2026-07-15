import SugboGoLogo from "@/shared/components/SugboGoLogo";
import { Text, View } from "react-native";
interface AuthHeaderProps {
  subtitle?: string;
}

export default function AuthHeader({
  subtitle = "Discover the Hidden Gems of Cebu.",
}: AuthHeaderProps) {
  return (
    <View className="mb-14 items-center">
      <View className=" flex flex-row justify-center items-center">
        <SugboGoLogo />
        <Text className="text-logo text-[28px] font-bold tracking-[0.5px]">
          <Text className="text-brand">Sugbo</Text>
          <Text className="text-text-primary">Go</Text>
        </Text>
      </View>
      <Text className="text-body text-[12px] text-text-secondary">
        {subtitle}
      </Text>
    </View>
  );
}
