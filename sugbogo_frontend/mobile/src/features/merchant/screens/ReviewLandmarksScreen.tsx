import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import LandmarkMap from "../components/registration/landmark/LanmarkMap";

import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { theme } from "@/constants/theme";

type ReviewLandmarksScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onClose: () => void;
};

export default function ReviewLandmarksScreen({
  businessLocation,
  selectedLandmarks,
  onClose,
}: ReviewLandmarksScreenProps) {
  return (
    <View className="flex-1 bg-background">
      {/* Map */}
      <View className="h-80">
        <LandmarkMap
          businessLocation={businessLocation}
          selectedLandmarks={selectedLandmarks}
          initialLatitudeDelta={0.004}
          initialLongitudeDelta={0.004}
        />

        {/* Back button */}
        <Pressable
          onPress={() => {
            onClose();
          }}
          className="absolute left-4 top-8 h-11 w-11 items-center justify-center rounded-full bg-surface"
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      </View>

      {/* Landmark content */}
      <SafeAreaView edges={["bottom"]} className="flex-1">
        <View className="flex-1 px-6 pt-5 bg-surface">
          <View className="mb-4">
            <Text className="text-lg font-bold text-text-primary">
              Your Landmarks
            </Text>

            <Text className="mt-1 text-sm text-text-secondary">
              These landmarks will be included with your business location.
            </Text>
          </View>

          <View className="flex-1">
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {selectedLandmarks.length > 0 ? (
                selectedLandmarks.map((landmark) => (
                  <View
                    key={landmark.id}
                    className="mb-3 flex-row rounded-xl border border-border-primary px-4 py-3"
                  >
                    <MaterialCommunityIcons
                      name={
                        landmark.source === "google"
                          ? "map-marker"
                          : "map-marker-plus"
                      }
                      size={22}
                      color="#F27F0D"
                    />

                    <View className="ml-3 flex-1">
                      <Text className="text-sm font-semibold text-text-primary">
                        {landmark.name}
                      </Text>

                      <Text className="mt-1 text-xs text-text-secondary">
                        {landmark.address || "Custom landmark"}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View className="items-center rounded-xl border border-border-primary px-4 py-6">
                  <Text className="text-sm text-text-secondary">
                    No landmarks selected.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Scroll affordance */}
            {selectedLandmarks.length > 4 && (
              <View className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 items-center justify-end">
                <View className="mb-1 rounded-full bg-background/90 px-2">
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color="#6B7280"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
