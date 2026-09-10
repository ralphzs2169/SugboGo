import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ActivityIndicator, Text, View } from "react-native";

import { ProfileImagePicker } from "../ProfileImagePicker";

const MASCOT_AVATAR_SITTING = require("@/shared/assets/mascot/mascot-avatar-sitting.webp");

type Props = {
  imageUrl: string | null;
  isShowingCustomProfilePicture: boolean;
  hasSelectedImage: boolean;
  isUploading: boolean;
  onImageSelected: (image: string) => void;
  onRemovePicture: () => void;
};

/**
 * Displays the editable profile picture with the SugboGo mascot perched
 * above it and provides visual feedback while a new picture is uploading.
 */
export default function EditProfileHeader({
  imageUrl,
  isShowingCustomProfilePicture,
  hasSelectedImage,
  isUploading,
  onImageSelected,
  onRemovePicture,
}: Props) {
  return (
    <View>
      {/* Profile avatar */}
      <View className="mt-16 items-center">
        <View className="relative">
          {/* Sitting mascot */}
          <View
            pointerEvents="none"
            className="absolute left-1/2 z-10"
            style={{
              top: -54,
              transform: [{ translateX: -152 }],
            }}
          >
            <Image
              source={MASCOT_AVATAR_SITTING}
              style={{
                width: 64,
                height: 64,
              }}
              contentFit="contain"
            />
          </View>

          {/* Editable profile picture */}
          <View
            className="overflow-hidden rounded-full border-4 border-white"
            style={{
              elevation: 5,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 6,
              shadowOffset: {
                width: 0,
                height: 3,
              },
            }}
          >
            <ProfileImagePicker
              imageUrl={imageUrl}
              isShowingCustomProfilePicture={isShowingCustomProfilePicture}
              hasSelectedImage={hasSelectedImage}
              isUploading={isUploading}
              onImageSelected={onImageSelected}
              onRemovePicture={onRemovePicture}
            />

            {/* Change-photo overlay */}
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center rounded-full bg-black/35"
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons
                  name="camera"
                  size={30}
                  color="#FFFFFF"
                />
              )}
            </View>
          </View>
        </View>

        {/* Profile photo guidance */}
        <Text className="mt-3 text-sm font-medium text-gray-500">
          {isUploading ? "Uploading photo..." : "Tap to change photo"}
        </Text>
      </View>
    </View>
  );
}
