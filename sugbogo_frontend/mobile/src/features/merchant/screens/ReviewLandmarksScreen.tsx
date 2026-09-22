import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";
import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

import LandmarkMap from "../components/registration/landmark/LanmarkMap";

type ReviewLandmarksScreenProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onClose: () => void;
};

/**
 * Displays a read-only review of the merchant's selected landmarks.
 *
 * Combines the business and landmark map preview with a concise landmark list
 * so merchants can verify the location context before submitting or reviewing
 * their application.
 */
export default function ReviewLandmarksScreen({
  businessLocation,
  selectedLandmarks,
  onClose,
}: ReviewLandmarksScreenProps) {
  return (
    <View className="flex-1 bg-background">
      {/* Landmark map preview */}
      <View className="h-[42%] min-h-72">
        <LandmarkMap
          businessLocation={businessLocation}
          selectedLandmarks={selectedLandmarks}
          initialLatitudeDelta={0.014}
          initialLongitudeDelta={0.014}
        />

        {/* Map navigation */}
        <SafeAreaView
          edges={["top"]}
          pointerEvents="box-none"
          className="absolute left-0 right-0 top-0 px-screen-x"
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface active:bg-surface-secondary"
            style={shadows.floating}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>
        </SafeAreaView>
      </View>

      {/* Landmark review content */}
      <SafeAreaView
        edges={["bottom"]}
        className="-mt-5 flex-1 rounded-t-3xl border-t border-border-primary bg-surface"
        style={shadows.docked}
      >
        <View className="flex-1 px-screen-x pt-5">
          {/* Review heading */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-4">
              <AppText weight="bold" className="text-lg text-text-primary">
                Your landmarks
              </AppText>

              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                These landmarks help explorers recognize places near your
                business.
              </AppText>
            </View>

            <View className="min-w-8 items-center justify-center rounded-full bg-surface-secondary px-2 py-1">
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                {selectedLandmarks.length}
              </AppText>
            </View>
          </View>

          {/* Selected landmarks */}
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 16,
            }}
          >
            {selectedLandmarks.length > 0 ? (
              <View className="gap-2">
                {selectedLandmarks.map((landmark) => (
                  <View
                    key={landmark.id}
                    className="flex-row items-center rounded-xl border border-border-primary bg-surface px-3.5 py-3"
                  >
                    <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                      <MaterialCommunityIcons
                        name={
                          landmark.source === "google"
                            ? "map-marker-outline"
                            : "map-marker-plus-outline"
                        }
                        size={19}
                        color={theme.extends.colors.text.secondary}
                      />
                    </View>

                    <View className="ml-3 min-w-0 flex-1">
                      <View className="flex-row items-center">
                        <AppText
                          weight="semibold"
                          className="min-w-0 flex-1 text-sm text-text-primary"
                          numberOfLines={1}
                        >
                          {landmark.name}
                        </AppText>

                        {landmark.source === "custom" && (
                          <View className="ml-2 rounded-full bg-brand/10 px-2 py-0.5">
                            <AppText
                              weight="semibold"
                              className="text-[10px] text-brand"
                            >
                              Custom
                            </AppText>
                          </View>
                        )}
                      </View>

                      <AppText
                        className="mt-0.5 text-xs leading-4 text-text-secondary"
                        numberOfLines={2}
                      >
                        {landmark.address || "Custom landmark"}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              /* Empty landmark state */
              <View className="items-center rounded-xl border border-dashed border-border-primary px-4 py-7">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
                  <MaterialCommunityIcons
                    name="map-marker-off-outline"
                    size={21}
                    color={theme.extends.colors.text.tertiary}
                  />
                </View>

                <AppText
                  weight="semibold"
                  className="mt-3 text-sm text-text-primary"
                >
                  No landmarks selected
                </AppText>

                <AppText className="mt-1 text-center text-xs text-text-secondary">
                  No nearby or custom landmarks were added to this location.
                </AppText>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}
