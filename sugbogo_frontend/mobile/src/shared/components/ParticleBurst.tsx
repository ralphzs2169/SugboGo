import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Portal, PortalHost } from "@gorhom/portal";
import {
  type PropsWithChildren,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  AccessibilityInfo,
  AppState,
  Platform,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  measure,
  runOnUI,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { theme } from "@/constants/theme";

const HOST_NAME = "particle-bursts";
const DURATION = 820;
const PARTICLE_INDICES = Array.from({ length: 10 }, (_, index) => index);

export type ParticleBurstHandle = {
  play: () => void;
  cancel: () => void;
  setPressed: (pressed: boolean) => void;
};

type Particle = {
  x: number;
  y: number;
  rotation: number;
};

/** Hosts decorative effects above navigation and bottom-sheet portals. */
export function ParticleBurstHost() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { zIndex: 1000, elevation: 1000 }]}
    >
      <PortalHost name={HOST_NAME} />
    </View>
  );
}

/** Moves a single lightweight sparkle entirely on the UI thread. */
function Sparkle({
  index,
  color,
  particles,
  progress,
}: {
  index: number;
  color: string;
  particles: SharedValue<Particle[]>;
  progress: SharedValue<number>;
}) {
  const size = 7 + (index % 3) * 2;
  const style = useAnimatedStyle(() => {
    const value = progress.value;
    const particle = particles.value[index];
    return {
      opacity: particle ? 1 - value : 0,
      transform: [
        { translateX: (particle?.x ?? 0) * (1 - (1 - value) ** 2) },
        { translateY: (particle?.y ?? 0) * value + 22 * value * value },
        { rotate: `${(particle?.rotation ?? 0) * value}deg` },
        { scale: 1 - value * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: -size / 2,
          top: -size / 2,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="star-four-points"
        size={size}
        color={color}
      />
    </Animated.View>
  );
}

/** Plays an imperative, anchored celebration independently of server/cache state. */
export default function ParticleBurst({
  children,
  ref,
  color = theme.extends.colors.brand,
}: PropsWithChildren<{
  ref?: Ref<ParticleBurstHandle>;
  color?: string;
}>) {
  const anchor = useAnimatedRef<Animated.View>();
  const requestId = useRef(0);
  const activeRequest = useSharedValue(0);
  const progress = useSharedValue(1);
  const scale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  const particles = useSharedValue<Particle[]>([]);
  const initialReducedMotion = useReducedMotion();
  const reducedMotion = useRef(initialReducedMotion);

  useEffect(() => {
    const stop = () => {
      requestId.current += 1;
      activeRequest.value = requestId.current;
      cancelAnimation(progress);
      cancelAnimation(scale);
      cancelAnimation(pressScale);
      progress.value = 1;
      scale.value = 1;
      pressScale.value = 1;
    };
    const motionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reducedMotion.current = enabled;
        if (enabled) stop();
      },
    );
    const appSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      motionSubscription.remove();
      appSubscription.remove();
      stop();
    };
  }, [activeRequest, pressScale, progress, scale]);

  useImperativeHandle(ref, () => ({
    cancel: () => {
      requestId.current += 1;
      activeRequest.value = requestId.current;
      cancelAnimation(progress);
      cancelAnimation(scale);
      cancelAnimation(pressScale);
      progress.value = 1;
      scale.value = 1;
      pressScale.value = 1;
    },
    setPressed: (pressed) => {
      if (reducedMotion.current) return;
      pressScale.value = withTiming(pressed ? 0.95 : 1, {
        duration: pressed ? 70 : 100,
      });
    },
    play: () => {
      if (AppState.currentState !== "active") return;
      // Selected color, icon and count already provide the minimal motion-free state.
      if (reducedMotion.current) return;
      const currentRequest = ++requestId.current;
      activeRequest.value = currentRequest;
      // Generate plain data on JS; Array.from's callback is not a UI worklet.
      const nextParticles = PARTICLE_INDICES.map((index) => {
        const angle = (index / 10) * Math.PI * 2 + Math.random() * 0.35;
        const distance = 36 + Math.random() * 32;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 42,
          rotation: (Math.random() - 0.5) * 150,
        };
      });
      // The portal is already mounted: measurement and playback share one UI task.
      runOnUI((playRequest: number, preparedParticles: Particle[]) => {
        "worklet";
        if (activeRequest.value !== playRequest) return;
        const layout = measure(anchor);
        if (!layout || layout.width <= 0 || layout.height <= 0) return;
        originX.value = layout.pageX + layout.width / 2;
        originY.value = layout.pageY + layout.height / 2;
        particles.value = preparedParticles;
        progress.value = 0;
        progress.value = withTiming(1, {
          duration: DURATION,
          easing: Easing.out(Easing.quad),
        });
        scale.value = withSequence(
          withTiming(1.08, { duration: 120 }),
          withSpring(1, { dampingRatio: 0.75, duration: 600 }),
        );
      })(currentRequest, nextParticles);
      if (Platform.OS === "android") Vibration.vibrate(8);
    },
  }));

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pressScale.value }],
  }));
  const originStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: originX.value }, { translateY: originY.value }],
  }));

  return (
    <>
      <Animated.View ref={anchor} collapsable={false} style={style}>
        {children}
      </Animated.View>
      {/* Keep the small particle layer ready so confirmation needs no React commit. */}
      <Portal hostName={HOST_NAME}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { overflow: "visible" }]}
        >
          <Animated.View
            style={[{ position: "absolute", left: 0, top: 0 }, originStyle]}
          >
            {PARTICLE_INDICES.map((index) => (
              <Sparkle
                key={index}
                index={index}
                color={index % 2 === 0 ? color : theme.extends.colors.brand}
                particles={particles}
                progress={progress}
              />
            ))}
          </Animated.View>
        </View>
      </Portal>
    </>
  );
}
