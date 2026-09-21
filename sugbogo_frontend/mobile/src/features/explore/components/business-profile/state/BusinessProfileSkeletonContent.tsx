import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

import BusinessReviewCardSkeleton from "./BusinessReviewCardSkeleton";

/**
 * Mirrors the business profile structure while dynamic business data loads.
 *
 * Keeps the loading content inside the profile scroll shell and matches the
 * current hero overlap, quick-info card, specialty tiles, and review layout
 * to minimize visual shifting when real business data becomes available.
 */
export default function BusinessProfileSkeletonContent() {
  return (
    <>
      {/* Business hero and overlapping quick info */}
      <View className="bg-surface">
        {/* Hero */}
        <View className="relative h-80 w-full bg-surface-secondary">
          <Skeleton className="h-full w-full rounded-none" />

          {/* Navigation controls */}
          <View className="absolute left-4 right-4 top-4 flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
              android_ripple={{
                color: "rgba(0,0,0,0.08)",
              }}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={26}
                color={theme.extends.colors.text.primary}
              />
            </Pressable>

            <Skeleton className="h-10 w-10 rounded-full bg-white/95" />
          </View>

          {/* Business identity */}
          <View className="absolute bottom-12 left-5 right-5">
            <Skeleton className="h-7 w-3/4 rounded-md" />
            <Skeleton className="mt-2 h-4 w-2/3 rounded-md" />
          </View>
        </View>

        {/* Overlapping quick info */}
        <View className="relative z-10 -mt-8 px-4">
          <View
            className="flex-row items-stretch overflow-hidden rounded-xl border border-border-primary bg-surface"
            style={{
              shadowColor: "#000000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            }}
          >
            {/* Review summary */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-7 rounded-md" />
              <Skeleton className="mt-1 h-3 w-12 rounded-md" />
            </View>

            {/* Review/status divider */}
            <View className="my-3 w-px bg-border-primary" />

            {/* Operating status */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-14 rounded-md" />
              <Skeleton className="mt-1 h-3 w-20 rounded-md" />
            </View>

            {/* Status/distance divider */}
            <View className="my-3 w-px bg-border-primary" />

            {/* Distance summary */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-12 rounded-md" />
              <Skeleton className="mt-1 h-3 w-8 rounded-md" />
            </View>
          </View>
        </View>
      </View>

      {/* Specialties */}
      <View className=" bg-surface px-4 py-5">
        <AppText weight="bold" className="text-base text-text-primary">
          Specialties
        </AppText>

        <AppText className="mt-1 text-sm text-text-secondary">
          Vouch for what this place gets right
        </AppText>

        <View className="mt-3 flex-row gap-2">
          {/* Specialty placeholder */}
          <View className="min-h-24 flex-1 items-center justify-center rounded-xl border border-border-primary px-3 py-2.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="mt-1.5 h-3 w-14 rounded-md" />

            <View className="mt-2 flex-row items-center">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="ml-1 h-3 w-4 rounded-md" />
            </View>
          </View>

          {/* Specialty placeholder */}
          <View className="min-h-24 flex-1 items-center justify-center rounded-xl border border-border-primary px-3 py-2.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="mt-1.5 h-3 w-16 rounded-md" />

            <View className="mt-2 flex-row items-center">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="ml-1 h-3 w-4 rounded-md" />
            </View>
          </View>

          {/* Specialty placeholder */}
          <View className="min-h-24 flex-1 items-center justify-center rounded-xl border border-border-primary px-3 py-2.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="mt-1.5 h-3 w-12 rounded-md" />

            <View className="mt-2 flex-row items-center">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="ml-1 h-3 w-4 rounded-md" />
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

      {/* Plan your visit */}
      <View className="mt-2 bg-surface px-4 py-5">
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <AppText weight="bold" className="mb-3 text-base text-text-primary">
            Plan Your Visit
          </AppText>
        </View>

        {/* Location */}
        <View className="flex-row">
          <Skeleton className="h-5 w-5 rounded-full" />

          <View className="ml-3 flex-1 gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/5 rounded-md" />
          </View>
        </View>

        {/* Getting there options */}
        <Skeleton className="mt-4 h-11 w-full rounded-md" />

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

      {/* Photos */}
      <View className="mt-2 bg-surface px-4 py-5">
        <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
          <AppText weight="bold" className="mb-3 text-base text-text-primary">
            See What&apos;s Here
          </AppText>
        </View>

        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1 rounded-lg" />
          <Skeleton className="h-24 flex-1 rounded-lg" />
          <Skeleton className="h-24 flex-1 rounded-lg" />
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
