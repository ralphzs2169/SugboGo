import type { ViewProps } from "react-native";
import Animated, {
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";

const sectionTransition = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);

/** Keeps Explore section position and size changes brief and respects reduced motion. */
export default function ExploreSection({
  children,
  ...props
}: ViewProps) {
  return (
    <Animated.View {...props} layout={sectionTransition}>
      {children}
    </Animated.View>
  );
}
