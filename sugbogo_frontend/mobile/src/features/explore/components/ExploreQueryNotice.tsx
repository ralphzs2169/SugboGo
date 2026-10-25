import { useRef, useState } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

type Props = {
  message: string;
  retryLabel: string;
  onRetry: () => Promise<unknown>;
};

/** Keeps cached content usable while offering quiet, localized query recovery. */
export default function ExploreQueryNotice({
  message,
  retryLabel,
  onRetry,
}: Props) {
  const pending = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  async function retry() {
    if (pending.current) return;
    pending.current = true;
    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // The owning query keeps its error and this recovery action available.
    } finally {
      pending.current = false;
      setIsRetrying(false);
    }
  }

  return (
    <View className="flex-row items-center gap-3 px-4 py-2">
      <AppText className="flex-1 text-xs text-text-secondary">
        {message}
      </AppText>
      <Button
        title="Retry"
        accessibilityLabel={retryLabel}
        onPress={() => void retry()}
        loading={isRetrying}
        variant="outline"
        size="sm"
        className="min-h-12"
      />
    </View>
  );
}
