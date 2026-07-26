import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  isShowingCustomProfilePicture: boolean;
  hasSelectedImage: boolean;
  onChoosePhoto: () => void;
  onTakePhoto: () => void;
  onRemovePicture: () => void;
};

/**
 * ProfilePictureBottomSheet provides actions for managing a user's profile picture.
 *
 * Displays available image actions and delegates behavior through callbacks.
 * The component controls the bottom sheet presentation lifecycle while the
 * parent handles image selection and profile updates.
 */
export function ProfilePictureBottomSheet({
  sheetRef,
  isShowingCustomProfilePicture,
  hasSelectedImage,
  onChoosePhoto,
  onTakePhoto,
  onRemovePicture,
}: Props) {
  const canRemovePicture = isShowingCustomProfilePicture || hasSelectedImage;
  //Dismisses the sheet before opening the gallery picker.
  function handleChoosePhoto() {
    sheetRef.current?.dismiss();
    onChoosePhoto();
  }

  // Dismisses the sheet before opening the camera.
  function handleTakePhoto() {
    sheetRef.current?.dismiss();
    onTakePhoto();
  }

  //Dismisses the sheet before triggering picture removal confirmation.
  function handleRemovePicture() {
    sheetRef.current?.dismiss();
    onRemovePicture();
  }

  // Closes the bottom sheet manually.
  function handleClose() {
    sheetRef.current?.dismiss();
  }

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["35%"]}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: "white",
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: "#D1D5DB",
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <BottomSheetView className="px-6 pb-8">
        {/* Header */}
        <View className="flex-row items-center justify-between  pb-4">
          <Text className="text-lg font-bold text-gray-900">
            Profile Picture
          </Text>

          <Pressable
            onPress={handleClose}
            className="rounded-full p-1 active:bg-gray-100"
          >
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {/* Actions */}
        <View className="pt-2">
          <Pressable
            onPress={handleChoosePhoto}
            className="flex-row items-center py-4"
          >
            <MaterialCommunityIcons
              name="image-outline"
              size={24}
              color="#1B4D3E"
            />

            <Text className="ml-4 text-base text-gray-800">Choose Photo</Text>
          </Pressable>

          <Pressable
            onPress={handleTakePhoto}
            className="flex-row items-center py-4"
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={24}
              color="#1B4D3E"
            />

            <Text className="ml-4 text-base text-gray-800">Take Photo</Text>
          </Pressable>

          {canRemovePicture && (
            <Pressable
              onPress={handleRemovePicture}
              className="flex-row items-center py-4"
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={24}
                color="#EF4444"
              />

              <Text className="ml-4 text-base font-medium text-red-500">
                Remove Current Photo
              </Text>
            </Pressable>
          )}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}
