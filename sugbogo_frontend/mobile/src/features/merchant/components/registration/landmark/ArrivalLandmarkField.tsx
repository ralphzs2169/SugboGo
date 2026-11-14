import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { View } from "react-native";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

import { MAX_SELECTED_LANDMARKS } from "@/features/merchant/constants/registration/map.constants";
import type useRegistrationErrorScroll from "@/features/merchant/hooks/registration/useRegistrationErrorScroll";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import FormSelect from "@/shared/components/form/FormSelect";
import FormTextArea from "@/shared/components/form/FormTextArea";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import RegistrationSection from "../RegistrationSection";

const NO_ARRIVAL_LANDMARK = "none";
const SHEET_SNAP_POINTS = ["65%"];
const ARRIVAL_LABEL = "Jeepney arrival landmark (optional)";

type ArrivalLandmarkFieldProps = {
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};

/** Lets a merchant choose one roadside landmark and write directions to the entrance. */
export default function ArrivalLandmarkField({
  registerErrorScrollTarget,
}: ArrivalLandmarkFieldProps) {
  const {
    clearErrors,
    setValue,
    formState: { disabled, errors },
  } = useFormContext<MerchantRegistrationForm>();
  const landmarks = useMerchantRegistrationStore(
    (state) => state.selectedLandmarks,
  );
  const setArrivalLandmark = useMerchantRegistrationStore(
    (state) => state.setArrivalLandmark,
  );
  const setArrivalDirections = useMerchantRegistrationStore(
    (state) => state.setArrivalDirections,
  );

  const arrivalIndex = landmarks.findIndex(
    (landmark) => landmark.is_arrival_point,
  );
  const arrivalLandmark = landmarks[arrivalIndex];
  const landmarkError =
    errors.landmarks?.message ?? errors.landmarks?.root?.message;
  const directionsField =
    `landmarks.${arrivalIndex}.access_directions` as const;
  const directionsError =
    errors.landmarks?.[arrivalIndex]?.access_directions?.message;
  const landmarkErrorTarget = useMemo(
    () =>
      registerErrorScrollTarget("landmarks.message", "landmarks.root.message"),
    [registerErrorScrollTarget],
  );
  const directionsErrorTarget = useMemo(
    () => registerErrorScrollTarget(directionsField),
    [registerErrorScrollTarget, directionsField],
  );

  function syncLandmarks() {
    setValue(
      "landmarks",
      useMerchantRegistrationStore.getState().selectedLandmarks,
      { shouldDirty: true },
    );
  }

  function selectLandmark(id: string | null) {
    if (disabled) return;

    if (id === (arrivalLandmark?.id ?? null) && !landmarkError) return;

    setArrivalLandmark(id);
    syncLandmarks();
    clearErrors("landmarks");
  }

  return (
    <ArrivalLandmarkSelection
      landmarks={landmarks}
      disabled={disabled}
      landmarkError={landmarkError}
      directionsError={directionsError}
      landmarkErrorTarget={landmarkErrorTarget}
      directionsErrorTarget={directionsErrorTarget}
      onSelect={selectLandmark}
      onDirectionsChange={(directions) => {
        setArrivalDirections(directions);
        syncLandmarks();
        if (directions.trim() && directionsError) {
          clearErrors(directionsField);
        }
      }}
      onAddCustom={() =>
        router.push({
          pathname: "/(explorer)/merchant-registration/landmarks-picker",
          params: { purpose: "arrival" },
        })
      }
    />
  );
}

type SelectionProps = {
  landmarks: BusinessLandmark[];
  disabled?: boolean;
  landmarkError?: string;
  directionsError?: string;
  landmarkErrorTarget?: React.ComponentProps<typeof View>;
  directionsErrorTarget?: React.ComponentProps<typeof View>;
  onSelect: (id: string | null) => void;
  onDirectionsChange: (directions: string) => void;
  onAddCustom: () => void;
};

/** Shares the arrival picker and walking directions across merchant location forms. */
export function ArrivalLandmarkSelection({
  landmarks,
  disabled,
  landmarkError,
  directionsError,
  landmarkErrorTarget,
  directionsErrorTarget,
  onSelect,
  onDirectionsChange,
  onAddCustom,
}: SelectionProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const openCustomPickerAfterDismiss = useRef(false);
  const arrivalLandmark = landmarks.find(
    (landmark) => landmark.is_arrival_point,
  );
  const atCapacity = landmarks.length >= MAX_SELECTED_LANDMARKS;

  function openCustomPicker() {
    if (disabled || atCapacity || !sheetRef.current) return;

    openCustomPickerAfterDismiss.current = true;
    sheetRef.current.dismiss();
  }

  function handleSheetDismiss() {
    if (!openCustomPickerAfterDismiss.current) return;

    openCustomPickerAfterDismiss.current = false;
    if (disabled) return;

    onAddCustom();
  }

  return (
    <RegistrationSection
      title={ARRIVAL_LABEL}
      description="If your entrance is hard to reach by jeepney, choose a recognizable roadside spot and tell visitors how to walk from there."
      icon="map-marker-outline"
    >
      {/* Arrival selection and entrance directions */}
      <View {...landmarkErrorTarget}>
        <FormSelect
          label={ARRIVAL_LABEL}
          showLabel={false}
          value={arrivalLandmark?.name}
          placeholder="Choose landmark"
          onPress={() => presentBottomSheet(sheetRef)}
          disabled={disabled}
          error={landmarkError}
        />
      </View>

      {arrivalLandmark && (
        <View key={arrivalLandmark.id} {...directionsErrorTarget}>
          <FormTextArea
            label="Walking directions to your entrance"
            placeholder="Example: Take the alley beside the bakery. Our entrance is the green gate."
            value={arrivalLandmark.access_directions ?? ""}
            required
            maxLength={1000}
            editable={!disabled}
            error={directionsError}
            onChangeText={onDirectionsChange}
          />
        </View>
      )}

      {/* Landmark options and the custom map picker entry point */}
      <SelectionBottomSheet
        sheetRef={sheetRef}
        title="Choose a jeepney arrival landmark"
        options={[
          { label: "No arrival landmark", value: NO_ARRIVAL_LANDMARK },
          ...landmarks.map((landmark) => ({
            label: landmark.name,
            value: landmark.id,
            description: landmark.address || undefined,
          })),
        ]}
        selectedValue={arrivalLandmark?.id ?? NO_ARRIVAL_LANDMARK}
        onSelect={(value) => {
          if (!disabled) onSelect(value === NO_ARRIVAL_LANDMARK ? null : value);
        }}
        onDismiss={handleSheetDismiss}
        snapPoints={SHEET_SNAP_POINTS}
        singleChoice
        footer={
          <View className="gap-2 border-t border-border-primary/60 pt-3">
            <Button
              title="Add a custom landmark"
              variant="soft"
              size="sm"
              rounded="full"
              className="min-h-12"
              onPress={openCustomPicker}
              disabled={disabled || atCapacity}
            />
            {atCapacity && (
              <AppText className="text-sm text-text-secondary">
                Remove a place from Nearby Landmarks to add a custom landmark.
              </AppText>
            )}
          </View>
        }
      />
    </RegistrationSection>
  );
}
