import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import Skeleton from "@/shared/components/Skeleton";
import { SkeletonPulseProvider } from "@/shared/components/SkeletonPulseProvider";

/**
 * Mirrors the business profile structure while dynamic business data loads.
 *
 * Static section labels remain visible while skeleton placeholders are used
 * only for content that depends on the business profile response.
 */
export default function BusinessProfileSkeleton() {
  return (
    <SkeletonPulseProvider>
      <SafeAreaView edges={["top"]} className="flex-1 bg-background">
        <ScrollView
          className="flex-1 bg-background"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View className="relative h-72 w-full bg-surface-secondary">
            <Skeleton className="h-full w-full rounded-none" />
            {/* Back button */}
            <View className="absolute left-4 top-4">
              <Pressable
                onPress={() => router.back()}
                className="h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
                android_ripple={{ color: "rgba(0,0,0,0.08)" }}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={26}
                  color={theme.extends.colors.text.primary}
                />
              </Pressable>
            </View>
            {/* Business identity */}
            <View className="absolute bottom-5 left-4 right-4">
              <Skeleton className="h-7 w-3/4 rounded-md" />
              <Skeleton className="mt-2 h-4 w-2/3 rounded-md" />
            </View>
          </View>
          {/* Quick info */}
          <View className="flex-row border-b border-border-primary bg-surface">
            <View className="flex-1 items-center justify-center py-4">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="mt-2 h-3 w-16" />
            </View>
            <View className="flex-1 items-center justify-center border-x border-border-primary py-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-3 w-24" />
            </View>
            <View className="flex-1 items-center justify-center py-4">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="mt-2 h-3 w-10" />
            </View>
          </View>
          {/* Specialties */}
          <View className="mt-2 bg-surface px-4 py-5">
            <Text className="text-base font-bold text-text-primary">
              Specialties
            </Text>
            <Text className="mt-1 text-sm text-text-secondary">
              Vouch for what this place gets right
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
            </View>
          </View>
          {/* About */}
          <View className="mt-2 bg-surface px-4 py-5">
            <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
              <Text className="mb-3 text-base font-bold text-text-primary">
                About this place
              </Text>
            </View>
            <View className="gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </View>
          </View>
          {/* Plan your visit */}
          <View className="mt-2 bg-surface px-4 py-5">
            <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
              <Text className="mb-3 text-base font-bold text-text-primary">
                Plan Your Visit
              </Text>
            </View>
            {/* Location */}
            <View className="flex-row">
              <Skeleton className="h-5 w-5 rounded-full" />
              <View className="ml-3 flex-1 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
              </View>
            </View>
            {/* Directions */}
            <Skeleton className="mt-4 h-11 w-full rounded-md" />
            {/* Hours */}
            <View className="mt-4 border-t border-border-primary/60 pt-4">
              <View className="flex-row items-center">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="ml-3 h-4 w-20" />
                <Skeleton className="ml-auto h-3 w-20" />
              </View>
            </View>
            {/* Contact */}
            <View className="mt-4 border-t border-border-primary/60">
              <View className="flex-row items-center py-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="ml-3 h-4 flex-1" />
              </View>
              <View className="flex-row items-center border-t border-border-primary/60 py-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="ml-3 h-4 w-4/5" />
              </View>
              <View className="flex-row items-center border-t border-border-primary/60 py-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="ml-3 h-4 w-3/4" />
              </View>
            </View>
          </View>
          {/* Photos */}
          <View className="mt-2 bg-surface px-4 py-5">
            <View className="mb-3 flex-row items-center justify-between border-b border-border-primary">
              <Text className="mb-3 text-base font-bold text-text-primary">
                See What's Here
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Skeleton className="h-24 flex-1 rounded-lg" />
              <Skeleton className="h-24 flex-1 rounded-lg" />
              <Skeleton className="h-24 flex-1 rounded-lg" />
            </View>
          </View>
          {/* Reviews */}
          <View className="mt-2 bg-surface">
            <View className="mb-4 flex-row items-center justify-between px-4 pt-5">
              <Text className="text-base font-bold text-text-primary">
                Reviews
              </Text>
              <Text className="text-sm font-semibold text-brand">See all</Text>
            </View>
            {/* Review card */}
            <View className="border-b border-border-primary px-4 py-4">
              {/* Review author */}
              <View className="flex-row items-center">
                <Skeleton className="h-[38px] w-[38px] rounded-full" />
                <View className="ml-3 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-16" />
                </View>
                <Skeleton className="h-5 w-5 rounded-full" />
              </View>
              {/* Review content */}
              <View className="mt-3 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[68%]" />
              </View>
              {/* Review photos */}
              <View className="mt-3 flex-row gap-2">
                <Skeleton className="aspect-square flex-1 rounded-lg" />
                <Skeleton className="aspect-square flex-1 rounded-lg" />
                <Skeleton className="aspect-square flex-1 rounded-lg" />
              </View>
              {/* Specialty vouches */}
              <View className="mt-4">
                <View className="mb-2 flex-row items-center">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="ml-1.5 h-3 w-20" />
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-28 rounded-full" />
                </View>
              </View>
              {/* Like action */}
              <View className="mt-3 flex-row items-center">
                <Skeleton className="h-[21px] w-[21px] rounded-full" />
                <Skeleton className="ml-1.5 h-3 w-5" />
              </View>
            </View>
          </View>
          {/* Bottom spacing */}
          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </SkeletonPulseProvider>
  );
}
