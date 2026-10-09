import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { pickBusinessPhotos } from "../../components/business-photos/PhotoPicker";
import PhotoPreview from "../../components/business-photos/PhotoPreview";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import useUpdateMerchantBusinessPhotos from "../../hooks/business-profile/useUpdateMerchantBusinessPhotos";
import {
  BUSINESS_PHOTO_CATEGORIES,
  BUSINESS_PHOTO_LIMITS,
  buildBusinessPhotosFormData,
  mapBusinessPhotosToDrafts,
  validateBusinessPhotoDrafts,
  visiblePhotos,
  type BusinessPhotoCategory,
  type BusinessPhotoDrafts,
} from "../../utils/businessPhotos.utils";

const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;

const CATEGORY_LABELS: Record<BusinessPhotoCategory, string> = {
  storefront: "Storefront",
  interior: "Interior",
  products: "Products",
  additional: "Additional",
};

/**
 * Allows merchants to manage their approved business photos.
 *
 * Displays full-width update guidance, organizes photos by category,
 * supports adding, removing, and restoring photos, and saves validated
 * changes without administrator approval. Suspended businesses cannot edit.
 */
export default function MerchantBusinessPhotosEditScreen() {
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const initializedBusinessId = useRef<number | null>(null);

  const { business, isLoading, error, refetch } = useMerchantBusinessProfile();

  const { savePhotos, isSaving } = useUpdateMerchantBusinessPhotos(
    business?.id,
  );

  const [drafts, setDrafts] = useState<BusinessPhotoDrafts>(() =>
    mapBusinessPhotosToDrafts([]),
  );

  const [deletedIds, setDeletedIds] = useState<number[]>([]);

  const [categoryErrors, setCategoryErrors] = useState<
    Partial<Record<BusinessPhotoCategory, string>>
  >({});

  const [pickingCategory, setPickingCategory] =
    useState<BusinessPhotoCategory | null>(null);

  const isPicking = pickingCategory !== null;

  useEffect(() => {
    if (!business || initializedBusinessId.current === business.id) {
      return;
    }

    initializedBusinessId.current = business.id;
    setDrafts(mapBusinessPhotosToDrafts(business.photos));
    setDeletedIds([]);
  }, [business]);

  const hasNewPhotos = BUSINESS_PHOTO_CATEGORIES.some((category) =>
    drafts[category].some((photo) => photo.id === undefined),
  );

  const hasChanges = hasNewPhotos || deletedIds.length > 0;

  async function addPhotos(category: BusinessPhotoCategory) {
    if (isPicking || isSaving) {
      return;
    }

    const count = visiblePhotos(drafts[category], deletedIds).length;

    if (count >= BUSINESS_PHOTO_LIMITS[category]) {
      return;
    }

    setPickingCategory(category);

    try {
      const selected = await pickBusinessPhotos({
        currentCount: count,
        maxPhotos: BUSINESS_PHOTO_LIMITS[category],
        maxOriginalSize: MAX_ORIGINAL_SIZE,
      });

      if (selected.length > 0) {
        setDrafts((current) => ({
          ...current,
          [category]: [...current[category], ...selected],
        }));

        setCategoryErrors((current) => ({
          ...current,
          [category]: undefined,
        }));
      }
    } catch (caught) {
      Toast.show({
        type: "error",
        text1: "Unable to add photos",
        text2: caught instanceof Error ? caught.message : "Please try again.",
      });
    } finally {
      setPickingCategory(null);
    }
  }

  function removePhoto(category: BusinessPhotoCategory, index: number) {
    const photo = visiblePhotos(drafts[category], deletedIds)[index];

    if (!photo) {
      return;
    }

    if (photo.id !== undefined) {
      setDeletedIds((current) => [...current, photo.id!]);
      return;
    }

    setDrafts((current) => ({
      ...current,
      [category]: current[category].filter((item) => item !== photo),
    }));
  }

  async function saveChanges() {
    if (
      savingRef.current ||
      isSaving ||
      isPicking ||
      !hasChanges ||
      business?.status !== "active"
    ) {
      return;
    }

    const errors = validateBusinessPhotoDrafts(drafts, deletedIds);
    setCategoryErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    savingRef.current = true;

    try {
      await savePhotos(buildBusinessPhotosFormData(drafts, deletedIds));

      Toast.show({
        type: "success",
        text1: "Business photos updated",
      });

      router.back();
    } catch (caught) {
      const response = caught as ApiError;

      if (response.code === "VALIDATION_ERROR" && response.errors) {
        const nextErrors: Partial<Record<BusinessPhotoCategory, string>> = {};

        for (const category of BUSINESS_PHOTO_CATEGORIES) {
          nextErrors[category] = response.errors[category]?.[0];
        }

        setCategoryErrors(nextErrors);
      }

      if (!handleSystemError(response)) {
        Toast.show({
          type: "error",
          text1: "Unable to save business photos",
          text2: response.message || "Please try again.",
        });
      }
    } finally {
      savingRef.current = false;
    }
  }

  // Initial business loading state
  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Business Photos"
        description="Fetching your current photos..."
      />
    );
  }

  // Business profile unavailable
  if (!business) {
    return (
      <ErrorState
        title="Unable to load business photos"
        description={
          error ? "Please try again." : "Business photos are unavailable."
        }
        primaryActionTitle="Retry"
        onPrimaryAction={refetch}
        secondaryActionTitle="Go Back"
        onSecondaryAction={() => router.back()}
      />
    );
  }

  // Suspended businesses cannot edit photos
  if (business.status !== "active") {
    return (
      <ErrorState
        title="Editing unavailable"
        description="Photos cannot be edited while your business is suspended."
        primaryActionTitle="Go Back"
        onPrimaryAction={() => router.back()}
      />
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-width photo management information banner */}
        <View className="bg-info px-4 py-4">
          <View className="flex-row items-start">
            <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={theme.extends.colors.text.info}
              />
            </View>

            <View className="ml-3 flex-1">
              <AppText weight="semibold" className="text-sm text-text-primary">
                About photo updates
              </AppText>

              <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                Photo changes don't require administrator approval and will
                appear on your business listing after saving. You can undo photo
                removals before saving.
              </AppText>

              <AppText className="mt-2 text-xs leading-5 text-text-secondary">
                JPG, JPEG, or PNG · Maximum 10 MB per original photo
              </AppText>
            </View>
          </View>
        </View>

        {/* Photo category collections */}
        <View className="px-5 pt-5">
          {BUSINESS_PHOTO_CATEGORIES.map((category) => {
            const photos = visiblePhotos(drafts[category], deletedIds);

            const removed = drafts[category].filter(
              (photo) =>
                photo.id !== undefined && deletedIds.includes(photo.id),
            );

            const limit = BUSINESS_PHOTO_LIMITS[category];

            return (
              <View
                key={category}
                className="mb-4 rounded-xl border border-border-primary bg-surface p-4"
              >
                {/* Photo category header */}
                <View className="mb-3 flex-row items-center justify-between">
                  <AppText
                    weight="bold"
                    className="text-base text-text-primary"
                  >
                    {CATEGORY_LABELS[category]}
                  </AppText>

                  <AppText className="text-sm text-text-secondary">
                    {photos.length} / {limit}
                  </AppText>
                </View>

                {/* Existing photos and add-photo action */}
                <View className="flex-row flex-wrap gap-y-3">
                  {photos.map((photo, index) => (
                    <PhotoPreview
                      key={photo.id ?? `${photo.uri}-${index}`}
                      uri={photo.uri}
                      onRemove={() => removePhoto(category, index)}
                    />
                  ))}

                  {photos.length < limit ? (
                    <Pressable
                      onPress={() => void addPhotos(category)}
                      disabled={isPicking || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${category} photos`}
                      className="h-24 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border-secondary"
                    >
                      {pickingCategory === category ? (
                        <ActivityIndicator color={theme.extends.colors.brand} />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="plus"
                            size={24}
                            color={theme.extends.colors.text.primary}
                          />

                          <AppText className="mt-1 text-xs text-text-secondary">
                            Add Photo
                          </AppText>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>

                {/* Restore previously removed photos */}
                {removed.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onPress={() =>
                      setDeletedIds((current) =>
                        current.filter((id) => id !== photo.id),
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Undo removal of ${photo.fileName ?? category} photo`}
                    className="mt-3 cursor-pointer self-start rounded-lg bg-surface-secondary px-3 py-2"
                  >
                    <AppText className="text-xs text-text-secondary">
                      {photo.fileName ?? "Photo"} marked for removal · Undo
                    </AppText>
                  </Pressable>
                ))}

                {/* Category validation feedback */}
                {categoryErrors[category] ? (
                  <AppText className="mt-3 text-sm text-text-error">
                    {categoryErrors[category]}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Persistent save and cancel actions */}
      <View
        className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          title="Cancel"
          variant="outline"
          className="flex-1"
          onPress={() => router.back()}
          disabled={isSaving}
          rounded="full"
        />

        <Button
          title="Save Changes"
          className="flex-1"
          onPress={() => void saveChanges()}
          disabled={!hasChanges || isPicking}
          loading={isSaving}
          rounded="full"
        />
      </View>
    </View>
  );
}
