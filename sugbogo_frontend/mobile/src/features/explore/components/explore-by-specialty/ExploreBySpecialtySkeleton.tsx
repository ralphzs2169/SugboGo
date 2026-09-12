import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

const LOADING_TILE_COUNT = 6;

/**
 * Displays placeholder tiles for the Explore by Specialty section.
 *
 * Mirrors the circular specialty icon and label layout so the loading state
 * transitions smoothly into the final shortcut grid.
 */
export default function ExploreBySpecialtySkeleton() {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-5 px-4">
      {/* Specialty tile placeholders */}
      {Array.from({ length: LOADING_TILE_COUNT }).map((_, index) => (
        <View key={index} className="w-[31%] items-center">
          <Skeleton className="h-16 w-16 rounded-full" />

          <View className="mt-2.5 items-center gap-1.5">
            <Skeleton className="h-3 w-16 rounded-md" />

            {index % 3 === 1 && <Skeleton className="h-3 w-11 rounded-md" />}
          </View>
        </View>
      ))}
    </View>
  );
}
