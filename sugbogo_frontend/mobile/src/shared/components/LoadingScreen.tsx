import { View, Text } from "react-native";
import LottieView from "lottie-react-native";
import loadingAnimation from "@/shared/assets/animations/loading.json";

type LoadingScreenProps = {
  title: string;
  description: string;
};

/**
 * Displays a full-screen loading state for long-running operations.
 *
 * Used when users must wait for a process to complete before they can
 * continue, such as email verification, session restoration, or data loading.
 */
export default function LoadingScreen({
  title,
  description,
}: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="items-center justify-center">
        <LottieView
          source={loadingAnimation}
          autoPlay
          loop
          style={{
            width: 70,
            height: 70,
          }}
        />
      </View>

      <Text className="mb-4 mt-5 text-center text-xl font-bold text-text-primary">
        {title}
      </Text>

      <Text className="text-center text-sm text-text-secondary">
        {description}
      </Text>
    </View>
  );
}
