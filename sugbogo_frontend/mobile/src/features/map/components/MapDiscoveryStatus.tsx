import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";
import type useMapDirectory from "../hooks/useMapDirectory";

type Notice = {
  message: string;
  busy?: boolean;
  retryLabel?: string;
  onRetry?: () => void;
};

type Props = {
  discovery: ReturnType<typeof useMapDirectory>;
  filterCount: number;
  openNowRequested: boolean;
  hasSelectedBusiness: boolean;
};

/** Lets map gestures pass through status text while keeping localized Retry accessible. */
function MapStatusNotice({
  message,
  busy = false,
  retryLabel,
  onRetry,
}: Notice) {
  return (
    <View
      pointerEvents="box-none"
      className="max-w-full flex-row items-center gap-2 self-start rounded-2xl border border-border-primary bg-surface px-3 py-1"
      style={shadows.floating}
    >
      <View
        pointerEvents="none"
        accessible
        accessibilityRole={busy ? "progressbar" : "text"}
        accessibilityLabel={message}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy }}
        className="shrink flex-row items-center gap-2 py-1"
      >
        {busy && (
          <ActivityIndicator
            size="small"
            color={theme.extends.colors.brand}
            accessible={false}
          />
        )}
        <AppText className="shrink text-xs text-text-secondary">
          {message}
        </AppText>
      </View>
      {onRetry && (
        <Button
          title="Retry"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          disabled={busy}
          variant="outline"
          size="sm"
          rounded="full"
          className="min-h-12 shrink-0"
        />
      )}
    </View>
  );
}

/** Distinguishes discovery and filter resolution without replacing the native map. */
export default function MapDiscoveryStatus({
  discovery,
  filterCount,
  openNowRequested,
  hasSelectedBusiness,
}: Props) {
  let directoryNotice: Notice | null = null;
  let openNowNotice: Notice | null = null;
  const offline =
    discovery.isOffline ||
    discovery.isPaused ||
    discovery.isPausedOpenNow;

  if (offline) {
    let message = "You're offline. Connect to load places.";
    if (discovery.hasDirectory) {
      message = discovery.isOpenNowUnresolved
        ? "Offline · Open Now not applied. Showing previous places."
        : "Offline · showing previous results";
    }
    directoryNotice = {
      message,
      retryLabel: "Retry loading places",
      onRetry: () => void discovery.refetch(),
    };
    if (
      discovery.hasDirectory &&
      openNowRequested &&
      (
        discovery.isOpenNowUnresolved ||
        discovery.isPausedOpenNow ||
        discovery.openNowError
      )
    ) {
      directoryNotice.retryLabel = "Retry checking opening hours";
      directoryNotice.onRetry = () => void discovery.refetchOpenNow();
    }
  } else if (discovery.error) {
    directoryNotice = {
      message: discovery.hasDirectory
        ? "Could not update places. Showing previous results."
        : "Could not load businesses",
      retryLabel: "Retry loading places",
      onRetry: () => void discovery.refetch(),
      busy: discovery.isFetching,
    };
  } else if (!discovery.hasDirectory && discovery.isLoading) {
    directoryNotice = { message: "Finding places…", busy: true };
  } else if (
    discovery.hasDirectory &&
    !hasSelectedBusiness &&
    !discovery.isOpenNowUnresolved &&
    !discovery.openNowError &&
    discovery.businesses.length === 0
  ) {
    directoryNotice = {
      message: discovery.allBusinesses.length === 0 || filterCount === 0
        ? "No businesses are available yet."
        : "No businesses match these map filters. Clear or adjust filters.",
    };
  } else if (
    discovery.hasDirectory &&
    discovery.isFetching &&
    !discovery.isOpenNowUnresolved
  ) {
    directoryNotice = { message: "Updating places…", busy: true };
  }

  if (openNowRequested && !offline) {
    if (discovery.openNowError) {
      openNowNotice = {
        message: discovery.hasOpenNowResult
          ? "Could not update opening hours. Showing last results."
          : "Could not check opening hours. Open Now is not applied.",
        retryLabel: "Retry checking opening hours",
        onRetry: () => void discovery.refetchOpenNow(),
        busy: discovery.isFetchingOpenNow,
      };
    } else if (discovery.hasDirectory && discovery.isOpenNowUnresolved) {
      openNowNotice = {
        message: discovery.isApplyingOpenNow
          ? "Checking what's open… Showing previous places."
          : "Open Now has not been applied yet.",
        busy: discovery.isApplyingOpenNow,
      };
    }
  }

  if (!directoryNotice && !openNowNotice) {
    return null;
  }

  return (
    <View className="gap-2" pointerEvents="box-none">
      {/* Directory recovery remains separate from the Open Now query. */}
      {directoryNotice && <MapStatusNotice {...directoryNotice} />}
      {openNowNotice && <MapStatusNotice {...openNowNotice} />}
    </View>
  );
}
