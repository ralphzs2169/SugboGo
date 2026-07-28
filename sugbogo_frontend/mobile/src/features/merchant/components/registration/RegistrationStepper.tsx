import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import JeepneyIcon from "../../assets/icons/jeepney.svg";

const STEPPER_ANIMATION_DURATION = 450;
const JEEPNEY_SIZE = 40;
const JEEPNEY_OFFSET_X = -(JEEPNEY_SIZE / 1.2);
const JEEPNEY_OFFSET_Y = -28;

type RegistrationStepperProps = {
  title: string;
  currentStep: number;
  totalSteps: number;
};

/**
 * Displays the user's progress through the merchant
 * registration flow.
 *
 * Shared across all registration screens.
 */
export default function RegistrationStepper({
  currentStep,
  totalSteps,
  title,
}: RegistrationStepperProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(currentStep / totalSteps, {
      duration: STEPPER_ANIMATION_DURATION,
    });
  }, [currentStep, totalSteps]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const jeepneyStyle = useAnimatedStyle(() => ({
    left: `${progress.value * 100}%`,
    top: JEEPNEY_OFFSET_Y,
    transform: [{ translateX: JEEPNEY_OFFSET_X }],
  }));

  return (
    <View className="bg-surface px-6 pt-6 pb-4">
      <Text className="text-2xl font-bold text-text-primary">{title}</Text>

      <Text className="mt-1 text-sm font-medium text-text-secondary">
        Step {currentStep} of {totalSteps}
      </Text>

      <View className="relative mt-5">
        <View className="h-2 overflow-hidden rounded-full bg-border">
          <Animated.View
            className="h-full rounded-full bg-brand"
            style={progressStyle}
          />
        </View>

        <Animated.View className="absolute -top-3 z-10" style={jeepneyStyle}>
          <JeepneyIcon width={JEEPNEY_SIZE} height={JEEPNEY_SIZE} />
        </Animated.View>
      </View>
    </View>
  );
}
