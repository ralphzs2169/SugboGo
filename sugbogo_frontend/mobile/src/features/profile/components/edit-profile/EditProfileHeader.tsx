import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ProfileImagePicker } from "../ProfileImagePicker";
import ProfileBackground from "../../assets/profile-bg-illustration.svg";

type Props = {
  imageUrl: string | null;
  hasCustomProfilePicture: boolean;
  onImageSelected: (image: string) => void;
  onRemovePicture: () => void;
};

export default function EditProfileHeader({
  imageUrl,
  hasCustomProfilePicture,
  onImageSelected,
  onRemovePicture,
}: Props) {
  function handleAvatarPress() {
    // keep your existing picker logic here
    // or call your image picker function
  }

  return (
    <View>
      {/* Full width background */}
      <View className="h-44 w-full overflow-hidden">
        <ProfileBackground
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        />
      </View>

      {/* Avatar */}
      <View className="-mt-20 items-center">
        <Pressable
          onPress={handleAvatarPress}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.96 : 1 }],
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            className="relative rounded-full border-4 border-white"
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
              hasCustomProfilePicture={hasCustomProfilePicture}
              onImageSelected={onImageSelected}
              onRemovePicture={onRemovePicture}
            />

            {/* Camera badge */}
            <View
              className="absolute bottom-1 right-1 h-10 w-10 items-center justify-center rounded-full bg-white"
              style={{
                elevation: 4,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 4,
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
              }}
            >
              <MaterialCommunityIcons name="camera" size={20} color="#F27F0D" />
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
