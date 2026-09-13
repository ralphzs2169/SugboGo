import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

type Props = {
  count?: number;
};

/**
 * Displays loading placeholders for discovery shortcut rows.
 *
 * Mirrors the shortcut icon, title, subtitle, and navigation affordance so the
 * section transitions cleanly into the loaded shortcut list.
 */
export default function DiscoveryShortcutsSkeleton({ count = 3 }: Props) {
  return (
    <View className="gap-3 px-4">
      {/* Shortcut placeholders */}
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className="flex-row items-center rounded-card border border-border-primary bg-surface px-4 py-3.5"
        >
          {/* Shortcut icon */}
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />

          {/* Shortcut details */}
          <View className="ml-3 min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
          </View>

          {/* Navigation affordance */}
          <Skeleton className="ml-3 h-5 w-5 rounded-md" />
        </View>
      ))}
    </View>
  );
}
