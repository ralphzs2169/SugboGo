import { View, Text, ScrollView } from "react-native";
import CommunityTopBar from "../components/CommunityTopBar";
import PostCard from "../components/PostCard";
import { MOCK_COMMUNITY_POSTS } from "../constants/mockCommunityData";

export default function CommunityScreen() {
  return (
    <View className="flex-1 bg-background">
      <CommunityTopBar />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pt-4 pb-8">
        <Text className="px-4 mb-3 text-lg font-bold text-text-primary">
          Community Insights
        </Text>
        {MOCK_COMMUNITY_POSTS.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ScrollView>
    </View>
  );
}