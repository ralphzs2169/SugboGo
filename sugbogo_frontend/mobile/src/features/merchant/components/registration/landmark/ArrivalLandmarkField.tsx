import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { View } from "react-native";

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
  const sheetRef = useRef<BottomSheetModal>(null);
  const openCustomPickerAfterDismiss = useRef(false);

  const arrivalIndex = landmarks.findIndex(
    (landmark) => landmark.is_arrival_point,
  );
  const arrivalLandmark = landmarks[arrivalIndex];
  const atCapacity = landmarks.length >= MAX_SELECTED_LANDMARKS;
  const landmarkError =
    errors.landmarks?.message ?? errors.landmarks?.root?.message;
  const directionsField = `landmarks.${arrivalIndex}.access_directions` as const;
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

  function selectLandmark(value: string) {
    if (disabled) return;

    const id = value === NO_ARRIVAL_LANDMARK ? null : value;
    if (id === (arrivalLandmark?.id ?? null) && !landmarkError) return;

    setArrivalLandmark(id);
    syncLandmarks();
    clearErrors("landmarks");
  }

  function openCustomPicker() {
    if (disabled || atCapacity || !sheetRef.current) return;

    openCustomPickerAfterDismiss.current = true;
    sheetRef.current.dismiss();
  }

  function handleSheetDismiss() {
    if (!openCustomPickerAfterDismiss.current) return;

    openCustomPickerAfterDismiss.current = false;
    if (disabled) return;

    router.push({
      pathname: "/(explorer)/merchant-registration/landmarks-picker",
      params: { purpose: "arrival" },
    });
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
            onChangeText={(directions) => {
              if (disabled) return;

              setArrivalDirections(directions);
              syncLandmarks();
              if (directions.trim() && directionsError) {
                clearErrors(directionsField);
              }
            }}
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
        onSelect={selectLandmark}
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
