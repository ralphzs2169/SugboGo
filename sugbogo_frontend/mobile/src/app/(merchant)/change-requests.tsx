import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";

import AppText from "@/shared/components/AppText";
import ProfileMenuItem from "@/features/profile/components/ProfileMenuItem";

/** Collects existing reviewed-change histories in one entry point. */
export default function ChangeRequestsRoute() {
  const histories = [
    { title: "Business Name", route: "/(merchant)/business-update-requests" },
    {
      title: "Classification",
      route: "/(merchant)/business-update-requests/classification",
    },
    {
      title: "Location & Landmarks",
      route: "/(merchant)/business-update-requests/location",
    },
  ];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-8">
        {/* Request history navigation */}
        <View className="px-5 py-5">
          <AppText className="text-sm text-text-secondary">
            Review past and pending changes to your business listing.
          </AppText>
        </View>
        <View className="bg-surface">
          {histories.map((history) => (
            <ProfileMenuItem
              key={history.title}
              title={history.title}
              icon="history"
              onPress={() => router.push(history.route as Href)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
