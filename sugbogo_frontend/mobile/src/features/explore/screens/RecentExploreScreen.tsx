import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import BusinessCard from "../components/new-businesses/BusinessCard";
import ExploreSectionHeader from "../components/ExploreSectionHeader";
import RecentExploreHeader from "../components/RecentExploreHeader";
import useRecentExplore from "../hooks/useRecentExplore";
import type { RecommendationBusiness } from "../types/exploreBusiness.types";

/** Displays only approved local feeds, using pure cards without Pocket or impression hooks. */
export default function RecentExploreScreen() {
  const recent = useRecentExplore();
  const oldest = recent.feeds.length
    ? Math.min(...recent.feeds.map((feed) => feed.fetchedAt))
    : null;
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <RecentExploreHeader />
      {recent.grant && recent.isPending ? (
        <View className="gap-4 px-screen-x">
          <Skeleton className="h-8 rounded-md" />
          <Skeleton className="h-60 rounded-card" />
        </View>
      ) : recent.feeds.length ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-8"
        >
          {/* One quiet status for all historical sections; use the oldest displayed fetch. */}
          <View className="px-screen-x pb-2">
            <AppText className="text-xs leading-5 text-text-secondary">
              Showing previously loaded content
            </AppText>
            {oldest !== null && (
              <AppText className="text-xs leading-5 text-text-secondary">
                Updated {new Date(oldest).toLocaleString()}
              </AppText>
            )}
          </View>
          {recent.feeds.map((feed) => (
            <View
              key={feed.key}
              className="py-6"
              testID={`recent-section-${feed.key}`}
            >
              <ExploreSectionHeader title={feed.title} subtitle="" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3 px-4"
              >
                {feed.items.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={{ ...business, sentiment_rating: undefined }}
                    distance={null}
                    distanceAccuracy={null}
                    recommendationReason={
                      (business as RecommendationBusiness)
                        .recommendation_reason ?? null
                    }
                    onPress={() =>
                      router.push({
                        pathname: "/recent-explore/[businessId]",
                        params: { businessId: String(business.id) },
                      })
                    }
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ErrorState
          size="small"
          icon="store-off-outline"
          title="Recent Explore unavailable"
          description="Previously loaded places are no longer available on this device."
          primaryActionTitle="Sign in"
          onPrimaryAction={() => router.replace("/(auth)/login")}
        />
      )}
    </SafeAreaView>
  );
}
