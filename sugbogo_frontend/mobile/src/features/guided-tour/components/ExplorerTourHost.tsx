import { useIsRestoring } from "@tanstack/react-query";
import { router, useIsFocused, usePathname } from "expo-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState, View } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogoutConfirmationStore } from "@/features/auth/store/logoutConfirmation.store";
import { usePocketPicker } from "@/features/pockets/providers/PocketPickerContext";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

import { EXPLORER_HOME, EXPLORER_TOUR_STEPS } from "../constants/explorerTour";
import { ExplorerTourContext } from "../hooks/useExplorerTour";
import { useSpotlightTargets } from "../hooks/useSpotlightTargets";
import {
  hasHandledExplorerTour,
  recordExplorerTourHandled,
} from "../services/explorerTourStorage";
import SpotlightOverlay from "./SpotlightOverlay";

const TARGETS = EXPLORER_TOUR_STEPS.map((step) => step.target);

type TourSession = {
  ownerId: number;
  generation: number;
};

type Preference = TourSession & {
  status: "unseen" | "handled" | "unavailable";
};

type Playback = TourSession & {
  stepIndex: number;
};

function matchesSession(
  session: TourSession | null,
  ownerId: number | null,
  generation: number,
) {
  return session?.ownerId === ownerId && session.generation === generation;
}

function isCurrentSession(session: TourSession) {
  const auth = useAuthStore.getState();
  return (
    auth.isAuthenticated &&
    !auth.isLoading &&
    !auth.isSigningIn &&
    auth.user?.id === session.ownerId &&
    isAuthSessionCurrent(session.generation)
  );
}

function subscribeToAppState(notify: () => void) {
  const listener = AppState.addEventListener("change", notify);
  return () => listener.remove();
}

function isForeground() {
  return AppState.currentState === "active";
}

/**
 * Owns Explorer tour playback and keeps native measurements in the same
 * coordinate space as the overlay.
 */
export default function ExplorerTourHost({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const tabsFocused = useIsFocused();
  const exploreFocused = tabsFocused && pathname === "/explore";
  const ownerId = useAuthStore((state) => {
    const { user, isAuthenticated, isLoading, isSigningIn } = state;
    if (
      isAuthenticated &&
      !isLoading &&
      !isSigningIn &&
      user?.role === "explorer" &&
      user.has_completed_interest_selection
    ) {
      return user.id;
    }
    return null;
  });
  const generation = useSyncExternalStore(
    subscribeAuthSessionChanges,
    getAuthSessionGeneration,
    getAuthSessionGeneration,
  );
  const explorerMode = useAppModeStore((state) => state.activeMode === "explorer");
  const eligible =
    ownerId !== null && explorerMode && isAuthSessionCurrent(generation);

  const logoutOpen = useLogoutConfirmationStore((state) => state.isOpen);
  const picker = usePocketPicker();
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  const restoringQueries = useIsRestoring();
  const foreground = useSyncExternalStore(
    subscribeToAppState,
    isForeground,
    isForeground,
  );
  const [exploreLocationReady, setLocationReady] = useState(false);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [replay, setReplay] = useState<TourSession | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [started, setStarted] = useState<TourSession | null>(null);

  const {
    container,
    onContainerLayout,
    viewport,
    setTarget,
    invalidateLayout,
    targets,
  } = useSpotlightTargets(TARGETS, eligible && exploreFocused);

  const canPlay =
    eligible &&
    exploreFocused &&
    foreground &&
    exploreLocationReady &&
    !restoringQueries &&
    !logoutOpen &&
    !picker?.isOpen &&
    !keyboardOpen;

  const active =
    canPlay && matchesSession(playback, ownerId, generation) ? playback : null;
  const step = active ? EXPLORER_TOUR_STEPS[active.stepIndex] : null;
  const target = step ? targets?.get(step.target) : null;
  const overlayVisible = Boolean(target);

  const cancelReplay =
    replay !== null &&
    (!eligible ||
      !matchesSession(replay, ownerId, generation) ||
      !tabsFocused ||
      (pathname !== "/profile" && pathname !== "/explore"));

  useLayoutEffect(() => {
    // Visibility is derived above. Discard interrupted playback after commit.
    if (playback && !active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayback(null);
    }
    if (cancelReplay) {
      setReplay(null);
    }
  }, [active, cancelReplay, playback]);

  useEffect(() => {
    if (!eligible || ownerId === null) return;

    const session = { ownerId, generation };
    let cancelled = false;
    const updatePreference = (status: Preference["status"]) => {
      if (!cancelled && isCurrentSession(session)) {
        setPreference({ ...session, status });
      }
    };

    void hasHandledExplorerTour(ownerId).then(
      (handled) => updatePreference(handled ? "handled" : "unseen"),
      () => updatePreference("unavailable"),
    );

    return () => {
      cancelled = true;
    };
  }, [eligible, ownerId, generation]);

  useEffect(() => {
    if (!canPlay || !targets || ownerId === null || playback) return;

    const preferenceLoaded = matchesSession(preference, ownerId, generation);
    const manual =
      preferenceLoaded && matchesSession(replay, ownerId, generation);
    const automatic =
      preferenceLoaded &&
      preference?.status === "unseen" &&
      !matchesSession(started, ownerId, generation);

    if (!manual && !automatic) return;

    // Let the focused screen commit before blocking its touches.
    const frame = requestAnimationFrame(() => {
      const session = { ownerId, generation };
      if (!isCurrentSession(session)) return;

      setReplay(null);
      setStarted(session);
      setPlayback({ ...session, stepIndex: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    canPlay,
    generation,
    ownerId,
    playback,
    preference,
    replay,
    started,
    targets,
  ]);

  const requestReplay = useCallback(() => {
    if (!eligible || !tabsFocused || ownerId === null) return false;

    const session = { ownerId, generation };
    if (!isCurrentSession(session)) return false;

    if (pathname !== "/explore") router.navigate(EXPLORER_HOME);
    setReplay(session);
  }, [eligible, generation, ownerId, pathname, tabsFocused]);

  const dismiss = useCallback(() => setPlayback(null), []);
  const setExploreLocationReady = useCallback(
    (ready: boolean) => {
      if (container.current) setLocationReady(ready);
    },
    [container],
  );
  const tour = useMemo(
    () => ({ requestReplay, setExploreLocationReady, setTarget, invalidateLayout }),
    [requestReplay, setExploreLocationReady, setTarget, invalidateLayout],
  );

  function finish() {
    if (!active || !isCurrentSession(active)) return;

    const { ownerId, generation } = active;
    setPlayback(null);
    if (
      matchesSession(preference, ownerId, generation) &&
      preference?.status === "handled"
    ) {
      return;
    }

    const session = { ownerId, generation };
    setPreference({ ...session, status: "handled" });
    void recordExplorerTourHandled(ownerId).catch(() => {
      if (!container.current || !isCurrentSession(session)) return;
      setPreference({ ...session, status: "unavailable" });
      Toast.show({
        type: "error",
        text1: "Could not save your tour preference",
      });
    });
  }

  function moveStep(offset: number) {
    setPlayback((current) => {
      if (!current) return current;
      const stepIndex = current.stepIndex + offset;
      if (stepIndex < 0 || stepIndex >= EXPLORER_TOUR_STEPS.length) return current;
      return { ...current, stepIndex };
    });
  }

  return (
    <ExplorerTourContext.Provider value={tour}>
      <View
        ref={container}
        testID="explorer-tour-viewport"
        collapsable={false}
        onLayout={onContainerLayout}
        style={{ flex: 1 }}
      >
        {/* Keep navigation mounted and shield it while tour controls are shown. */}
        <View
          style={{ flex: 1 }}
          pointerEvents={overlayVisible ? "none" : "auto"}
          accessibilityElementsHidden={overlayVisible}
          importantForAccessibility={
            overlayVisible ? "no-hide-descendants" : "auto"
          }
        >
          {children}
        </View>

        {/* Steps share the same native target measurements. */}
        {step && active && target && (
          <SpotlightOverlay
            target={target}
            viewport={viewport}
            title={step.title}
            description={step.description}
            step={active.stepIndex + 1}
            total={EXPLORER_TOUR_STEPS.length}
            onBack={() => moveStep(-1)}
            onNext={
              active.stepIndex === EXPLORER_TOUR_STEPS.length - 1
                ? finish
                : () => moveStep(1)
            }
            onSkip={finish}
            onDismiss={dismiss}
          />
        )}
      </View>
    </ExplorerTourContext.Provider>
  );
}
