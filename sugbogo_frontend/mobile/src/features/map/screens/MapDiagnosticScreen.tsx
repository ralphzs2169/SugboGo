import * as Updates from "expo-updates";
import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutRectangle,
} from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

const LOAD_TIMEOUT_MS = 30_000;
const DIAGNOSTIC_MAP_ID = "ff9a89ad4b7211795769e17e";

const CEBU_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MODES = ["Original", "Default", "Diagnostic"] as const;

type Mode = (typeof MODES)[number];
type Visibility = "Visible" | "Blank";

type Trial = {
  id: number;
  mode: Mode;
  startedAt: number;
};

type Result = {
  layout: Pick<LayoutRectangle, "width" | "height"> | null;
  readyMs: number | null;
  loadedMs: number | null;
  timedOut: boolean;
  visibility: Visibility | null;
};

type Session = {
  trial: Trial | null;
  results: Partial<Record<Mode, Result>>;
};

const styles = StyleSheet.create({
  viewport: {
    width: "100%",
    height: 256,
  },
});

function describeTime(
  elapsedMs: number | null,
  missing: string,
) {
  return elapsedMs === null ? missing : `${Math.round(elapsedMs)} ms`;
}

/** Mounts one fresh native map per trial and retains the latest result for each mode. */
export default function MapDiagnosticScreen() {
  const mapIds: Record<Mode, string | undefined> = {
    Original: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim(),
    Default: undefined,
    Diagnostic: DIAGNOSTIC_MAP_ID,
  };
  const [session, setSession] = useState<Session>({
    trial: null,
    results: {},
  });
  const { trial, results } = session;
  const trialMapId = trial ? mapIds[trial.mode] : undefined;

  const record = useCallback((
    currentTrial: Trial,
    update: (result: Result) => Result,
  ) => {
    setSession((previous) => {
      const result = previous.results[currentTrial.mode];

      if (previous.trial !== currentTrial || !result) {
        return previous;
      }

      return {
        ...previous,
        results: {
          ...previous.results,
          [currentTrial.mode]: update(result),
        },
      };
    });
  }, []);

  function startTrial(
    mode: Mode,
    startedAt: number,
  ) {
    setSession((previous) => ({
      trial: {
        id: (previous.trial?.id ?? 0) + 1,
        mode,
        startedAt,
      },
      results: {
        ...previous.results,
        [mode]: {
          layout: null,
          readyMs: null,
          loadedMs: null,
          timedOut: false,
          visibility: null,
        },
      },
    }));
  }

  useEffect(() => {
    if (!trial) {
      return;
    }

    const remainingMs = LOAD_TIMEOUT_MS - (performance.now() - trial.startedAt);
    const timeout = setTimeout(() => {
      record(trial, (result) => ({
        ...result,
        timedOut: result.loadedMs === null || result.loadedMs >= LOAD_TIMEOUT_MS,
      }));
    }, Math.max(0, remainingMs));

    return () => clearTimeout(timeout);
  }, [record, trial]);

  function recordMapEvent(
    currentTrial: Trial,
    event: "readyMs" | "loadedMs",
    observedAt: number,
  ) {
    const elapsedMs = observedAt - currentTrial.startedAt;

    record(currentTrial, (result) => ({
      ...result,
      [event]: result[event] ?? elapsedMs,
    }));
  }

  const downloadedUpdateId = Updates.isEmbeddedLaunch
    ? "Embedded bundle"
    : (Updates.updateId ?? "Unavailable");

  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="gap-3 px-screen-x py-3"
        removeClippedSubviews={false}
      >
        {/* Trial controls */}
        <View className="flex-row flex-wrap gap-2">
          {MODES.map((mode) => (
            <Button
              key={mode}
              title={mode}
              accessibilityLabel={`Run ${mode}`}
              onPress={() => startTrial(mode, performance.now())}
              disabled={mode === "Original" && !mapIds.Original}
              variant={trial?.mode === mode ? "primary" : "outline"}
              size="sm"
              className="min-h-12 min-w-24 flex-1"
            />
          ))}
        </View>
        {!mapIds.Original && (
          <AppText className="text-sm text-text-secondary">
            The original Map ID is unavailable in this update.
          </AppText>
        )}

        {/* Keep controls and results outside the measured map viewport. */}
        {trial ? (
          <>
            <AppText weight="semibold" className="text-sm text-text-primary">
              {trial.mode} map · Trial {trial.id}
            </AppText>
            <MapView
              key={trial.id}
              testID="diagnostic-map"
              style={styles.viewport}
              provider={PROVIDER_GOOGLE}
              mapType="standard"
              initialRegion={CEBU_REGION}
              scrollEnabled={false}
              zoomEnabled={false}
              zoomControlEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              {...(trialMapId ? { googleMapId: trialMapId } : {})}
              onLayout={({ nativeEvent }) => {
                const { width, height } = nativeEvent.layout;
                record(trial, (result) => ({
                  ...result,
                  layout: { width, height },
                }));
              }}
              onMapReady={() => recordMapEvent(trial, "readyMs", performance.now())}
              onMapLoaded={() => recordMapEvent(trial, "loadedMs", performance.now())}
            />
            <View className="flex-row gap-2">
              {(["Visible", "Blank"] as const).map((visibility) => (
                <Button
                  key={visibility}
                  title={visibility === "Visible" ? "Streets visible" : "Map blank"}
                  onPress={() => record(trial, (result) => ({
                    ...result,
                    visibility,
                  }))}
                  variant={results[trial.mode]?.visibility === visibility ? "soft" : "outline"}
                  size="sm"
                  className="min-h-12 flex-1"
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.viewport} className="items-center justify-center bg-surface">
            <AppText className="text-sm text-text-secondary">
              Choose a mode to start.
            </AppText>
          </View>
        )}

        {/* Latest on-device result for each mode. */}
        <View className="gap-2">
          {MODES.map((mode) => {
            const result = results[mode];
            const layout = result?.layout;
            const timedOut = result?.timedOut
              || (result?.loadedMs != null && result.loadedMs >= LOAD_TIMEOUT_MS);
            const missing = trial?.mode === mode && !timedOut
              ? "Waiting"
              : "Not observed";

            return (
              <View
                key={mode}
                className="gap-1 rounded-card border border-border-primary bg-surface px-3 py-2"
              >
                <AppText weight="semibold" className="text-sm text-text-primary">
                  {mode}
                </AppText>
                {result ? (
                  <>
                    <AppText className="text-sm text-text-secondary">
                      Layout {layout ? `${layout.width} × ${layout.height} dp` : missing}
                      {" · Streets "}{result.visibility ?? "Unrecorded"}
                    </AppText>
                    <AppText className="text-sm text-text-secondary">
                      Ready {describeTime(result.readyMs, missing)}
                      {" · Loaded "}{describeTime(result.loadedMs, missing)}
                    </AppText>
                    {timedOut && (
                      <AppText className="text-sm text-text-primary">
                        Load timeout at 30 s
                      </AppText>
                    )}
                  </>
                ) : (
                  <AppText className="text-sm text-text-secondary">No trial yet</AppText>
                )}
              </View>
            );
          })}
        </View>

        {/* Identify the running bundle without displaying credential values. */}
        <View className="gap-1">
          <AppText className="text-sm text-text-secondary">
            Channel {Updates.channel ?? "Unavailable"}
            {" · Runtime "}{Updates.runtimeVersion ?? "Unavailable"}
          </AppText>
          <AppText selectable className="text-sm text-text-secondary">
            Downloaded update ID {downloadedUpdateId}
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
