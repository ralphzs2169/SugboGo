import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import FormTextArea from "@/shared/components/form/FormTextArea";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import RegistrationSection from "../registration/RegistrationSection";

/** Proposes one arrival landmark and entrance directions through the existing Admin review. */
export default function ArrivalLandmarkEditor({
  landmarks,
  onChange,
  disabled,
}: {
  landmarks: BusinessLandmark[];
  onChange: (landmarks: BusinessLandmark[]) => void;
  disabled: boolean;
}) {
  if (!landmarks.length) return null;

  return (
    <RegistrationSection
      title="Arrival landmark"
      description="Optional. Choose a roadside landmark visitors can reach before following your directions to the entrance. Admin must review it before it is used for Jeepney guidance."
      icon="map-marker-outline"
    >
      {/* One reviewed arrival point may extend guidance for a business away from the road. */}
      {landmarks.map((landmark) => (
        <View key={landmark.id} className="mb-3">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Use ${landmark.name} as arrival landmark`}
            accessibilityState={{
              checked: Boolean(landmark.is_arrival_point),
              disabled,
            }}
            disabled={disabled}
            className="min-h-12 justify-center rounded-xl border border-border-primary px-3 py-2 active:opacity-70"
            onPress={() =>
              onChange(
                landmarks.map((item) => ({
                  ...item,
                  is_arrival_point:
                    item.id === landmark.id
                      ? !landmark.is_arrival_point
                      : false,
                  access_directions:
                    item.id === landmark.id && !landmark.is_arrival_point
                      ? (item.access_directions ?? "")
                      : "",
                })),
              )
            }
          >
            <AppText weight="semibold" className="text-sm text-text-primary">
              {landmark.is_arrival_point
                ? "Selected arrival landmark: "
                : "Use as arrival landmark: "}
              {landmark.name}
            </AppText>
          </Pressable>
          {landmark.is_arrival_point && (
            <FormTextArea
              label="Directions from this landmark to your entrance"
              accessibilityLabel="Directions from this landmark to your entrance"
              required
              value={landmark.access_directions ?? ""}
              maxLength={1000}
              editable={!disabled}
              placeholder="From this landmark, enter the alley beside the bakery. Our entrance is the green gate."
              onChangeText={(value) =>
                onChange(
                  landmarks.map((item) =>
                    item.id === landmark.id
                      ? { ...item, access_directions: value }
                      : item,
                  ),
                )
              }
            />
          )}
        </View>
      ))}
    </RegistrationSection>
  );
}
