import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "react-native-toast-message/lib/src/Toast";

import { useAuthStore } from "@/features/auth/store/auth.store";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import FormInput from "@/shared/components/form/FormInput";
import FormSelect from "@/shared/components/form/FormSelect";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { handleSystemError } from "@/shared/utils/apiErrors";
import type { AvatarKey } from "@/shared/constants/avatars";

import AvatarPickerBottomSheet from "../components/edit-profile/AvatarPickerBottomSheet";
import EditProfileHeader from "../components/edit-profile/EditProfileHeader";
import { GENDER_OPTIONS } from "../constants/genderOptions";
import { useRemoveProfilePicture } from "../hooks/useRemoveProfilePicture";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";
import { Gender } from "../types/profile.types";
import getUpdateProfileErrors from "../utils/updateProfileErrors";
import {
  UpdateProfileErrors,
  validateProfileForm,
} from "../utils/updateProfileValidator";

/**
 * Allows users to edit their profile information and profile picture.
 */
export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const genderSheetRef = useRef<BottomSheetModal>(null);
  const avatarSheetRef = useRef<BottomSheetModal>(null);

  // Profile update operations
  const { updateUserProfile, isUpdating } = useUpdateProfile();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();
  const { removePicture, isRemoving } = useRemoveProfilePicture();

  // Form values
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [gender, setGender] = useState(user?.gender ?? null);

  // Profile picture draft state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(
    user?.avatar_url ?? null,
  );
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<AvatarKey | null>(
    user?.avatar_key ?? null,
  );

  // UI feedback state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [errors, setErrors] = useState<UpdateProfileErrors>({});
  const [formError, setFormError] = useState("");

  // Loading state
  const isSaving = isUploading || isUpdating || isRemoving;

  const hasChanges =
    firstName !== (user?.first_name ?? "") ||
    lastName !== (user?.last_name ?? "") ||
    gender !== (user?.gender ?? null) ||
    selectedImage !== null ||
    removeProfilePicture ||
    selectedAvatarKey !== (user?.avatar_key ?? null);

  const {
    showConfirm,
    confirmLeave,
    cancelLeave,
    navigateWithoutConfirmation,
  } = useUnsavedChangesGuard(hasChanges);

  const clearFieldError = (field: keyof UpdateProfileErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  function handleSelectGender() {
    genderSheetRef.current?.present();
  }

  /**
   * Marks the current uploaded profile picture for removal.
   * The profile will fall back to the user's SugboGo avatar.
   */
  function confirmRemovePicture() {
    setSelectedImage(null);
    setPreviewImage(null);
    setRemoveProfilePicture(true);
    setShowRemoveModal(false);
  }

  function handleRemovePicture() {
    setShowRemoveModal(true);
  }

  function handleSelectAvatar(avatarKey: AvatarKey) {
    setSelectedAvatarKey(avatarKey);
    setSelectedImage(null);
    setPreviewImage(null);
    setRemoveProfilePicture(user?.has_custom_profile_picture ?? false);
  }

  async function handleSaveChanges() {
    const validationErrors = validateProfileForm(firstName, lastName);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    // Remove the existing uploaded profile picture if requested.
    if (removeProfilePicture) {
      const removeResponse = await removePicture();

      if (!removeResponse.success) {
        setFormError(removeResponse.message);
        return;
      }
    }

    // Upload a newly selected profile picture.
    if (selectedImage) {
      const pictureResponse = await uploadProfilePicture(selectedImage);

      if (!pictureResponse.success) {
        setFormError(pictureResponse.message);
        return;
      }
    }

    // Update editable profile fields and the selected built-in avatar.
    if (
      firstName !== user?.first_name ||
      lastName !== user?.last_name ||
      gender !== user?.gender ||
      selectedAvatarKey !== (user?.avatar_key ?? null)
    ) {
      const response = await updateUserProfile({
        first_name: firstName,
        last_name: lastName,
        gender,
        avatar_key: selectedAvatarKey,
      });

      if (!response.success) {
        const fieldErrors = getUpdateProfileErrors(response);

        if (fieldErrors.firstName || fieldErrors.lastName) {
          setErrors(fieldErrors);
          return;
        }

        if (handleSystemError(response)) {
          Toast.show({
            type: "error",
            text1:
              response.message || "Unable to update profile. Please try again.",
          });
          return;
        }

        setFormError(response.message);
        return;
      }
    }

    setTimeout(() => {
      Toast.show({
        type: "info",
        text1: "Profile updated successfully.",
      });
    }, 1000);

    setSelectedImage(null);
    setRemoveProfilePicture(false);

    navigateWithoutConfirmation(() => {
      router.replace("/profile");
    });
  }

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        <EditProfileHeader
          imageUrl={previewImage}
          avatarKey={selectedAvatarKey}
          isShowingCustomProfilePicture={
            (user?.has_custom_profile_picture ?? false) && !removeProfilePicture
          }
          isUploading={isUploading}
          onImageSelected={(image) => {
            setSelectedImage(image);
            setPreviewImage(image);
            setRemoveProfilePicture(false);
          }}
          onChooseAvatar={() => avatarSheetRef.current?.present()}
          onRemovePicture={handleRemovePicture}
        />

        <View className="flex-1 p-5">
          <FormInput
            label="First Name"
            placeholder="Enter your first name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
            onFocus={() => clearFieldError("firstName")}
          />

          <FormInput
            label="Last Name"
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
            onFocus={() => clearFieldError("lastName")}
          />

          <FormSelect
            label="Gender"
            value={
              GENDER_OPTIONS.find((option) => option.value === gender)?.label ??
              ""
            }
            placeholder="Select gender"
            onPress={handleSelectGender}
          />

          {formError ? (
            <AppText className="mt-4 text-center text-sm text-text-error">
              {formError}
            </AppText>
          ) : null}

          <ConfirmModal
            visible={showRemoveModal}
            title="Remove profile picture?"
            message="Your uploaded profile picture will be removed and your SugboGo avatar will be shown instead."
            confirmText="Remove"
            destructive
            onCancel={() => setShowRemoveModal(false)}
            onConfirm={confirmRemovePicture}
          />

          <Button
            title="Save Changes"
            onPress={handleSaveChanges}
            loading={isSaving}
            disabled={!hasChanges || isSaving}
            className="mt-6 mb-10"
            rounded="full"
          />

          <ConfirmModal
            visible={showConfirm}
            title="Discard changes?"
            message="You have unsaved changes. Are you sure you want to leave?"
            confirmText="Discard"
            destructive
            onCancel={cancelLeave}
            onConfirm={confirmLeave}
          />

          <SelectionBottomSheet
            sheetRef={genderSheetRef}
            title="Select Gender"
            options={GENDER_OPTIONS}
            selectedValue={gender ?? undefined}
            onSelect={(value) => setGender(value as Gender)}
          />

          <AvatarPickerBottomSheet
            sheetRef={avatarSheetRef}
            selectedAvatarKey={selectedAvatarKey}
            onSelect={handleSelectAvatar}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
