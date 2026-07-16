import { ActivityIndicator, View } from "react-native";
import BrandLogo from "@/shared/components/BrandLogo";
export default function AppSplash() {
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <BrandLogo size="lg" />
    </View>
  );
}
