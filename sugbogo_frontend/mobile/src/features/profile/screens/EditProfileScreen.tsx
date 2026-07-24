import { Text, TextInput, View, Alert } from "react-native";
import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ProfileImagePicker } from "../components/ProfileImagePicker";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUpdateProfilePicture } from "../hooks/useUpdateProfilePicture";
import { router, useNavigation } from "expo-router";
import {
  UpdateProfileErrors,
  validateProfileForm,
} from "../utils/updateProfileValidator";
import FormInput from "@/features/auth/components/FormInput";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChanges";
import { Toast } from "react-native-toast-message/lib/src/Toast";
import getUpdateProfileErrors from "../utils/updateProfileErrors";

export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);

  const { updateUserProfile, isUpdating } = useUpdateProfile();
  const { uploadProfilePicture, isUploading } = useUpdateProfilePicture();

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [errors, setErrors] = useState<UpdateProfileErrors>({});
  const [formError, setFormError] = useState("");

  const isSaving = isUploading || isUpdating;

  const hasChanges =
    firstName !== (user?.first_name ?? "") ||
    lastName !== (user?.last_name ?? "") ||
    selectedImage !== null;

  const { allowLeave } = useUnsavedChangesGuard(hasChanges);

  const clearFieldError = (field: keyof UpdateProfileErrors) => {
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setFormError("");
  };

  async function handleSaveChanges() {
    const validationErrors = validateProfileForm(firstName, lastName);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setFormError("");

    if (selectedImage) {
      const pictureResponse = await uploadProfilePicture(selectedImage);

      if (!pictureResponse.success) {
        setFormError(pictureResponse.message);
        return;
      }
    }

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

    allowLeave();
    router.back();
  }
  return (
    <View className="flex-1 bg-surface p-5">
      <View className="mt-8 items-center">
        <ProfileImagePicker
          imageUrl={user?.avatar_url}
          onImageSelected={setSelectedImage}
        />

        <Text className="mt-2 text-sm text-brand">Change profile picture</Text>
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
