import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { usePulse } from "./SkeletonPulseProvider";

type Props = { className?: string };

export default function Skeleton({ className = "" }: Props) {
  const pulse = usePulse();
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={style}
      className={`rounded-md bg-border-primary ${className}`}
    />
  );
}
