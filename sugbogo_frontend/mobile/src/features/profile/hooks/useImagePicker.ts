import * as ImagePicker from "expo-image-picker";

const PROFILE_IMAGE_ASPECT: [number, number] = [1, 1];
const IMAGE_PICKER_QUALITY = 1;

/**
 * Custom hook for picking an image from the device's media library.
 * Returns null if the user cancels the image picker or if permission is denied.
 */
export function useImagePicker() {
  async function pickImage() {
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

  return {
    pickImage,
  };
}
