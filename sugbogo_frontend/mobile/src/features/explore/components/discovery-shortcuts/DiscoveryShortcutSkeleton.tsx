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
    <View className="mx-4 border-y border-border-primary">
      {/* Shortcut placeholders */}
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className={`min-h-20 flex-row items-center bg-surface py-4 ${index > 0 ? "border-t border-border-primary" : ""}`}
        >
          {/* Shortcut icon */}
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />

          {/* Shortcut details */}
          <View className="ml-3 min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
            <Skeleton className="mt-2 h-3 w-24 rounded-md" />
          </View>

          {/* Navigation affordance */}
          <Skeleton className="ml-3 h-5 w-5 rounded-md" />
        </View>
      ))}
    </View>
  );
}
