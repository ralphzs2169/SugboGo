import { Text } from "react-native";
import Constants from "expo-constants";

export default function AppVersion() {
  //   const version = Constants.expoConfig?.version;
  const version = "1.0.0"; // Fallback to "1.0.0" if version is undefined
  return (
    <Text className="mt-8 text-center text-sm text-text-tertiary">
      Version {version}
    </Text>
  );
}
