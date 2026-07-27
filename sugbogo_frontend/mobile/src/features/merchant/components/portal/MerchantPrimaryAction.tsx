import { View, Text } from "react-native";
import MerchantIllustration from "../assets/merchant-register-illustration.svg";

type MerchantHeroProps = {
  title: string;
  description: string;
};

export default function MerchantHero({
  title,
  description,
}: MerchantHeroProps) {
  return (
    <View className="items-center px-6 pt-10">
      <MerchantIllustration width={220} height={170} />

      <Text className="mt-8 text-2xl font-bold text-center text-foreground">
        {title}
      </Text>

      <Text className="mt-3 text-center text-muted-foreground leading-6">
        {description}
      </Text>
    </View>
  );
}
