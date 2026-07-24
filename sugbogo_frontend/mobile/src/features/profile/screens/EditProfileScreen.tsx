import { Text, ScrollView, View } from "react-native";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";
import { router } from "expo-router";
import {
  UpdateProfileErrors,
  validateProfileForm,
} from "../utils/updateProfileValidator";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import FormInput from "@/features/auth/components/FormInput";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import getUpdateProfileErrors from "../utils/updateProfileErrors";
import { useRemoveProfilePicture } from "../hooks/useRemoveProfilePicture";
import { useActionSheet } from "@expo/react-native-action-sheet";
import SelectionField from "@/shared/components/form/SelectionField";
import EditProfileHeader from "../components/edit-profile/EditProfileHeader";
import AvatarInfoCard from "../components/edit-profile/AvatarInfoCard";

/**
 * EditProfileScreen component allows users to edit their profile information,
 * including first name, last name, and profile picture.
 */
export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const { updateUserProfile, isUpdating } = useUpdateProfile();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();
  const { removePicture, isRemoving } = useRemoveProfilePicture();
  const { showActionSheetWithOptions } = useActionSheet();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [gender, setGender] = useState(user?.gender ?? null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(
    user?.avatar_url ?? null,
  );
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);

  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [errors, setErrors] = useState<UpdateProfileErrors>({});
  const [formError, setFormError] = useState("");

  const isSaving = isUploading || isUpdating || isRemoving;

  const hasChanges =
    firstName !== (user?.first_name ?? "") ||
    lastName !== (user?.last_name ?? "") ||
    gender !== (user?.gender ?? null) ||
    selectedImage !== null ||
    removeProfilePicture;

  const { allowLeave } = useUnsavedChangesGuard(hasChanges);

  const clearFieldError = (field: keyof UpdateProfileErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  function handleSelectGender() {
    const options = [
      "Male",
      "Female",
      "Non-binary",
      "Prefer not to say",
      "Cancel",
    ];

    const cancelButtonIndex = options.length - 1;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        title: "Select Gender",
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case 0:
            setGender("male");
            break;

          case 1:
            setGender("female");
            break;

          case 2:
            setGender("non_binary");
            break;

          case 3:
            setGender("prefer_not_to_say");
            break;
        }
      },
    );
  }

  function confirmRemovePicture() {
    setSelectedImage(null);
    setPreviewImage(null);
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

        setFormError(response.message);
        return;
      }
    }

    Toast.show({
      type: "success",
      text1: "Profile Updated",
    });

    setSelectedImage(null);
    setRemoveProfilePicture(false);

    allowLeave();
    router.back();
  }
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="pb-8"
      showsVerticalScrollIndicator={false}
    >
      <EditProfileHeader
        imageUrl={previewImage}
        hasCustomProfilePicture={user?.has_custom_profile_picture ?? false}
        onImageSelected={(image) => {
          setSelectedImage(image);
          setPreviewImage(image);
          setRemoveProfilePicture(false);
        }}
        onRemovePicture={() => setShowRemoveModal(true)}
      />

      {/* Info message */}
      <AvatarInfoCard
        visible={!user?.has_custom_profile_picture && !!user?.use_oauth_avatar}
      />

      {/* Form content */}
      <View className="flex-1 p-5">
        <FormInput
          label="FIRST NAME"
          placeholder="Enter your first name"
          value={firstName}
          onChangeText={setFirstName}
          error={errors.firstName}
          onFocus={() => clearFieldError("firstName")}
        />

        <FormInput
          label="LAST NAME"
          placeholder="Enter your last name"
          value={lastName}
          onChangeText={setLastName}
          error={errors.lastName}
          onFocus={() => clearFieldError("lastName")}
        />

        <SelectionField
          label="Gender"
          value={
            gender
              ? {
                  male: "Male",
                  female: "Female",
                  non_binary: "Non-binary",
                  prefer_not_to_say: "Prefer not to say",
                }[gender]
              : undefined
          }
          placeholder="Select your gender"
          onPress={handleSelectGender}
        />

        {formError ? (
          <Text className="mt-4 text-center text-sm text-error">
            {formError}
          </Text>
        ) : null}

        <ConfirmModal
          visible={showRemoveModal}
          title="Remove profile picture?"
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
          disabled={!hasChanges}
          className="mt-6 mb-10"
          icon={
            <MaterialCommunityIcons
              name="content-save-outline"
              size={20}
              color="white"
            />
          }
        />
      </View>
    </ScrollView>
  );
}
