import { ActivityIndicator, View } from "react-native";

export default function AppSplash() {
  return (
    <View className="flex-1 items-center justify-center bg-surface">
      <ActivityIndicator size="large" color="#F27F0D" />
    </View>
  );
}
