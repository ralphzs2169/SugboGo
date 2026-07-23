import * as ImagePicker from "expo-image-picker";

/**
 * Custom hook for picking an image from the device's media library.
 *
 * @returns {Object} An object containing the `pickImage` function.
 */
export function useImagePicker() {
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error("Permission to access photos was denied.");
    }

    // Launch the image picker and allow the user to select an image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
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
