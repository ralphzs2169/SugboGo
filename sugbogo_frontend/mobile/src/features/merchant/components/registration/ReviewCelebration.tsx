import { View } from "react-native";
import LottieView from "lottie-react-native";

import confettiAnimation from "@/shared/assets/animations/drop-confetti.json";

export default function ReviewCelebration() {
  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 top-0 z-50 items-center"
    >
      <View className="flex-row">
        <View className="h-[160px] w-[200px]">
          <LottieView
            source={confettiAnimation}
            autoPlay
            loop={false}
            style={{
              width: 200,
              height: 160,
              transform: [{ rotate: "90deg" }],
            }}
          />
        </View>

        <View className="h-[160px] w-[200px]">
          <LottieView
            source={confettiAnimation}
            autoPlay
            loop={false}
            style={{
              width: 200,
              height: 160,
              transform: [{ rotate: "-90deg" }],
            }}
          />
        </View>
      </View>
    </View>
  );
}
