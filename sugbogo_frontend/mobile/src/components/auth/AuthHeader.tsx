import { Image, Text, View } from "react-native";

interface AuthHeaderProps {
  subtitle?: string;
}

export default function AuthHeader({
  subtitle = "Discover the Hidden Gems of Cebu.",
}: AuthHeaderProps) {
  return (
    <View className="mb-6 items-center">
      <Image
        source={require("../../../assets/images/sugbogo-logo-small.png")}
        className="mb-2 h-[70px] w-[70px]"
        resizeMode="contain"
      />

      <Text className="text-[32px] font-bold tracking-[0.5px]">
        <Text className="text-[#F27F0D]">Sugbo</Text>
        <Text className="text-[#1A1A1A]">Go</Text>
      </Text>

      <Text className="mt-1 text-[13px] text-[#666]">{subtitle}</Text>
    </View>
  );
}
