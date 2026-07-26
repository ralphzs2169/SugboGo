import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ProfileImagePicker } from "../ProfileImagePicker";
import ProfileBackground from "../../assets/profile-bg-illustration.svg";

type Props = {
  imageUrl: string | null;
  isShowingCustomProfilePicture: boolean;
  hasSelectedImage: boolean;
  onImageSelected: (image: string) => void;
  onRemovePicture: () => void;
};

export default function EditProfileHeader({
  imageUrl,
  isShowingCustomProfilePicture,
  hasSelectedImage,
  onImageSelected,
  onRemovePicture,
}: Props) {
  return (
    <View>
      {/* Avatar */}
      <View className="mt-6 items-center">
        <View
          className="relative rounded-full overflow-hidden border-4 border-white"
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
            onImageSelected={onImageSelected}
            onRemovePicture={onRemovePicture}
          />

          <View className="pointer-events-none absolute inset-0 items-center justify-center rounded-full bg-black/35">
            <MaterialCommunityIcons name="camera" size={30} color="#FFFFFF" />
          </View>
        </View>

        <Text className="mt-3 text-sm font-medium text-gray-500">
          Tap to change photo
        </Text>
      </View>
    </View>
  );
}
