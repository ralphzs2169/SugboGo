import * as ImagePicker from "expo-image-picker";

const PROFILE_IMAGE_ASPECT: [number, number] = [1, 1];
const IMAGE_PICKER_QUALITY = 0.6;

/**
 * Provides utilities for selecting or capturing a profile image.
 *
 * Handles requesting the required device permissions and opening the
 * native image picker or camera. Returns the selected image URI or null
 * when the user cancels the operation.
 */
export function useImagePicker() {
  /**
   * Opens the device gallery and allows the user to select a profile image.
   * Requests media library permission before opening the native picker.
   *
   * @returns The selected image URI or null if the user cancels.
   */
  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Permission to access photos was denied.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: PROFILE_IMAGE_ASPECT,
      quality: IMAGE_PICKER_QUALITY,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  }

  /**
   * Opens the device camera and allows the user to capture a profile image.
   *
   * Requests camera permission before opening the native camera.
   *
   * @returns The captured image URI or null if the user cancels.
   */
  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Permission to access the camera was denied.");
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: PROFILE_IMAGE_ASPECT,
      quality: IMAGE_PICKER_QUALITY,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  }

  return {
    pickFromGallery,
    takePhoto,
  };
}
