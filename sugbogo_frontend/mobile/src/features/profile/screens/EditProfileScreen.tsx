import { Text, Modal, View, Pressable } from "react-native";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ProfileImagePicker } from "../components/ProfileImagePicker";
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

/**
 * EditProfileScreen component allows users to edit their profile information,
 * including first name, last name, and profile picture.
 */
export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const { updateUserProfile, isUpdating } = useUpdateProfile();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();
  const { removePicture, isRemoving } = useRemoveProfilePicture();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");

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
    if (firstName !== user?.first_name || lastName !== user?.last_name) {
      const response = await updateUserProfile({
        first_name: firstName,
        last_name: lastName,
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
    <View className="flex-1 bg-surface p-5">
      <View className="my-8  items-center">
        <ProfileImagePicker
          imageUrl={previewImage}
          hasCustomProfilePicture={user?.has_custom_profile_picture ?? false}
          onImageSelected={(image) => {
            setSelectedImage(image);
            setPreviewImage(image);
            setRemoveProfilePicture(false);
          }}
          onRemovePicture={() => setShowRemoveModal(true)}
        />

        <Text className="mt-2 text-sm text-brand">
          Tap to change profile picture
        </Text>

        {/* Informational message Section */}

        {!user?.has_custom_profile_picture && user?.use_oauth_avatar && (
          <View className="mt-4 flex-row items-start  rounded-xl  px-4 py-3">
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#2563EB"
            />

            <Text className="ml-2 flex-1 text-xs text-blue-700">
              Your social profile photo is currently being used as your avatar.
              You can change this preference in Account Settings.
            </Text>
          </View>
        )}
      </View>

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

      {formError ? (
        <Text className="mt-4 text-center text-sm text-error">{formError}</Text>
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
        className="mt-8"
        icon={
          <MaterialCommunityIcons
            name="content-save-outline"
            size={20}
            color="white"
          />
        }
      />
    </View>
  );
}
