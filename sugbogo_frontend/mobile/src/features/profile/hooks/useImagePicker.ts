import * as ImagePicker from "expo-image-picker";

const PROFILE_IMAGE_ASPECT: [number, number] = [1, 1];
const IMAGE_PICKER_QUALITY = 0.6;

/**
 * Handles selecting or capturing a profile image.
 */
export function useImagePicker() {
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
