import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";
import type { BusinessProfilePreview } from "../../../utils/businessProfilePreview";
import ExploreBusinessHero from "../ExploreBusinessHero";

import BusinessReviewCardSkeleton from "./BusinessReviewCardSkeleton";

/**
 * Mirrors the business profile structure while dynamic business data loads.
 *
 * Keeps the loading content inside the profile scroll shell and matches the
 * connected hero identity, inline metadata, specialty tiles, and review layout
 * to minimize visual shifting when real business data becomes available.
 */
export default function BusinessProfileSkeletonContent({
  onGoBack,
  preview,
}: {
  onGoBack: () => void;
  preview?: BusinessProfilePreview | null;
}) {
  return (
    <>
      {/* Business cover, identity, and inline metadata */}
      <ExploreBusinessHero
        business={preview ?? null}
        identityOnly
        isOwnBusiness={false}
        onShare={() => undefined}
        onGoBack={onGoBack}
      >
        <View className="mt-4 flex-row flex-wrap items-center gap-4">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </View>
      </ExploreBusinessHero>

      {/* Specialties */}
      <View className="mt-2 overflow-hidden rounded-md bg-surface px-4 py-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Specialties
        </AppText>

        <AppText className="mt-1 text-sm text-text-secondary">
          Vouch for what this place gets right
        </AppText>

        <View className="mt-3 rounded-xl bg-background px-1 py-2">
          <View className="flex-row flex-wrap items-start">
            {/* Specialty placeholder */}
            <View className="flex-1 items-center px-0.5 py-1">
              <Skeleton className="h-[62px] w-[62px] rounded-full" />
              <Skeleton className="mt-1 h-7 w-14 rounded-md" />

              <Skeleton className="mt-0.5 h-5 w-12 rounded-full" />
            </View>

            {/* Specialty placeholder */}
            <View className="flex-1 items-center px-0.5 py-1">
              <Skeleton className="h-[62px] w-[62px] rounded-full" />
              <Skeleton className="mt-1 h-7 w-16 rounded-md" />

              <Skeleton className="mt-0.5 h-5 w-12 rounded-full" />
            </View>

            {/* Specialty placeholder */}
            <View className="flex-1 items-center px-0.5 py-1">
              <Skeleton className="h-[62px] w-[62px] rounded-full" />
              <Skeleton className="mt-1 h-7 w-12 rounded-md" />

              <Skeleton className="mt-0.5 h-5 w-12 rounded-full" />
            </View>
          </View>
        </View>
      </View>

      {/* About */}
      <View className="mt-2 bg-surface px-4 py-5">
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <AppText weight="bold" className="mb-3 text-base text-text-primary">
            About this place
          </AppText>
        </View>

        <View className="gap-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-4/5 rounded-md" />
        </View>
      </View>

      {/* Photos */}
      <View className="mt-2 bg-surface px-4 py-5">
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <AppText weight="bold" className="mb-3 text-base text-text-primary">
            See What&apos;s Here
          </AppText>
        </View>

        <View className="flex-row gap-2">
          <Skeleton className="aspect-[4/3] flex-[2] rounded-card" />
          <View className="flex-1 gap-2">
            <Skeleton className="min-h-0 flex-1 rounded-card" />
            <Skeleton className="min-h-0 flex-1 rounded-card" />
          </View>
        </View>
      </View>

      {/* Plan your visit */}
      <View className="mt-2 bg-surface px-4 py-5">
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <AppText weight="bold" className="mb-3 text-base text-text-primary">
            Plan Your Visit
          </AppText>
        </View>

        {/* Location and map preview */}
        <AppText weight="semibold" className="text-base text-text-primary">
          Location
        </AppText>
        <Skeleton className="mt-4 h-[150px] w-full rounded-card" />
        <View className="mt-3 flex-row">
          <Skeleton className="h-5 w-5 rounded-full" />

          <View className="ml-3 flex-1 gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/5 rounded-md" />
          </View>
        </View>

        {/* Getting there options */}
        <AppText
          weight="semibold"
          className="mb-2 mt-4 text-base text-text-primary"
        >
          How to get there
        </AppText>
        <View className="flex-row gap-2">
          <Skeleton className="h-20 flex-1 rounded-xl" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
        </View>

        {/* Hours */}
        <View className="mt-4 border-t border-border-primary/60 pt-4">
          <View className="flex-row items-center">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="ml-3 h-4 w-20 rounded-md" />
            <Skeleton className="ml-auto h-3 w-20 rounded-md" />
          </View>
        </View>

        {/* Contact information */}
        <View className="mt-4 border-t border-border-primary/60">
          <View className="flex-row items-center py-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="ml-3 h-4 flex-1 rounded-md" />
          </View>

          <View className="flex-row items-center border-t border-border-primary/60 py-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="ml-3 h-4 w-4/5 rounded-md" />
          </View>

          <View className="flex-row items-center border-t border-border-primary/60 py-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="ml-3 h-4 w-3/4 rounded-md" />
          </View>
        </View>
      </View>

      {/* Reviews */}
      <View className="mt-2 bg-surface">
        <View className="flex-row items-center justify-between px-4 pb-4 pt-5">
          <AppText weight="bold" className="text-base text-text-primary">
            Reviews
          </AppText>

          <Skeleton className="h-4 w-16 rounded-md" />
        </View>

        <BusinessReviewCardSkeleton />
      </View>
    </>
  );
}
