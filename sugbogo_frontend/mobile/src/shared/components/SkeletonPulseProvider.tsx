import { createContext, useContext, useEffect } from "react";
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  SharedValue,
} from "react-native-reanimated";

const PulseContext = createContext<SharedValue<number> | null>(null);

export function SkeletonPulseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  return (
    <PulseContext.Provider value={pulse}>{children}</PulseContext.Provider>
  );
}

export function usePulse() {
  const ctx = useContext(PulseContext);
  if (!ctx)
    throw new Error("usePulse must be used within SkeletonPulseProvider");
  return ctx;
}
