import { Pressable, ImageBackground, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  name: string;
  photoUrl: string;
  tags: string[];
  onPress: () => void;
};

export default function HiddenGemCard({ name, photoUrl, tags, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="mr-3 h-80 w-80 overflow-hidden rounded-card">
      <ImageBackground
        source={{ uri: photoUrl }}
        className="flex-1 justify-between p-3"
        imageStyle={{ borderRadius: 16 }}
      >
        <View className="flex-row items-center self-start rounded-full bg-brand px-2 py-1">
          <MaterialCommunityIcons name="star-four-points" size={12} color="#FFFFFF" />
          <Text className="ml-1 text-xs font-bold text-white">HIDDEN GEM</Text>
        </View>

        <View>
          <Text className="text-base font-bold text-white" numberOfLines={2}>
            {name}
          </Text>
          <View className="mt-1 flex-row flex-wrap gap-1">
            {tags.map((tag) => (
              <View key={tag} className="rounded-full bg-black/50 px-2 py-0.5">
                <Text className="text-xs font-medium text-white">{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}