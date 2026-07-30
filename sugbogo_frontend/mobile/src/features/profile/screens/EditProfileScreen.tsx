import FormInput from "@/shared/components/form/FormInput";
import Button from "@/shared/components/Button";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import FormSelect from "@/shared/components/form/FormSelect";
import AvatarInfoCard from "../components/edit-profile/AvatarInfoCard";
import EditProfileHeader from "../components/edit-profile/EditProfileHeader";
import SelectionBottomSheet from "@/shared/components/bottom-sheets/SelectionBottomSheet";
import { GENDER_OPTIONS } from "../constants/genderOptions.";
import { Gender } from "../types/profile.types";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import { useRemoveProfilePicture } from "../hooks/useRemoveProfilePicture";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";
import getUpdateProfileErrors from "../utils/updateProfileErrors";
import {
  UpdateProfileErrors,
  validateProfileForm,
} from "../utils/updateProfileValidator";

/**
 * EditProfileScreen component allows users to edit their profile information,
 * including first name, last name, and profile picture.
 */
export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const genderSheetRef = useRef<BottomSheetModal>(null);

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
    removeProfilePicture;

  const isShowingCustomProfilePicture =
    selectedImage !== null ||
    ((user?.has_custom_profile_picture ?? false) && !removeProfilePicture);

  const { showConfirm, confirmLeave, cancelLeave } =
    useUnsavedChangesGuard(hasChanges);

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
   * Removes the profile picture locally before saving changes.
   * Falls back to the user's OAuth avatar when enabled.
   */
  function confirmRemovePicture() {
    setSelectedImage(null);

    if (user?.use_oauth_avatar && user?.oauth_avatar_url) {
      setPreviewImage(user.oauth_avatar_url);
    } else {
      setPreviewImage(null);
    }

    setRemoveProfilePicture(true);
    setShowRemoveModal(false);
  }

  async function handleSaveChanges() {
    const validationErrors = validateProfileForm(firstName, lastName);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    // If the user has chosen to remove their profile picture, call the removePicture function
    if (removeProfilePicture) {
      const removeResponse = await removePicture();

      if (!removeResponse.success) {
        setFormError(removeResponse.message);
        return;
      }
    }

    // If a new profile picture is selected, upload it
    if (selectedImage) {
      const pictureResponse = await uploadProfilePicture(selectedImage);

      if (!pictureResponse.success) {
        setFormError(pictureResponse.message);
        return;
      }
    }

    // Update first name and last name if they have changed
    if (
      firstName !== user?.first_name ||
      lastName !== user?.last_name ||
      gender !== user?.gender
    ) {
      const response = await updateUserProfile({
        first_name: firstName,
        last_name: lastName,
        gender: gender,
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
        type: "success",
        text1: "Profile updated successfully.",
      });
    }, 1000);

    setSelectedImage(null);
    setRemoveProfilePicture(false);

    router.replace("/profile");
  }

  /**
   * Handles profile picture removal.
   * Shows confirmation when removing a custom picture will reveal an OAuth avatar.
   */
  function handleRemovePicture() {
    const needsConfirmation =
      user?.has_custom_profile_picture &&
      user?.use_oauth_avatar &&
      !!user?.oauth_avatar_url;

    if (needsConfirmation) {
      setShowRemoveModal(true);
      return;
    }

    confirmRemovePicture();
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
          isShowingCustomProfilePicture={
            (user?.has_custom_profile_picture ?? false) && !removeProfilePicture
          }
          onImageSelected={(image) => {
            setSelectedImage(image);
            setPreviewImage(image);
            setRemoveProfilePicture(false);
          }}
          onRemovePicture={handleRemovePicture}
          hasSelectedImage={selectedImage !== null}
        />

        {/* Form content */}
        <View className="flex-1 p-5">
          {/* Displays OAuth avatar information after a local custom picture removal. */}
          <AvatarInfoCard
            visible={
              !isShowingCustomProfilePicture &&
              !!user?.use_oauth_avatar &&
              !!user?.oauth_avatar_url
            }
          />
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
            <Text className="mt-4 text-center text-sm text-error">
              {formError}
            </Text>
          ) : null}

          <ConfirmModal
            visible={showRemoveModal}
            title="Remove uploaded profile picture?"
            message="Your profile picture will change back to your Google or Facebook profile photo. You can change this anytime in Account Settings."
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
            icon={
              <MaterialCommunityIcons
                name="content-save-outline"
                size={20}
                color="white"
              />
            }
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
