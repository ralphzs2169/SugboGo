import { View, Text, Image } from "react-native";
import { useState } from "react";
import PostHeader from "./PostHeader";
import PostEngagementRow from "./PostEngagementRow";
import BusinessPreviewCard from "./BusinessPreviewCard";
import { TAG_COLORS, DEFAULT_TAG_COLOR } from "@/shared/constants/tagColors";
import { CommunityPost } from "../constants/mockCommunityData";

type Props = {
  post: CommunityPost;
};

export default function PostCard({ post }: Props) {
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(post.helpfulCount);

  const handleToggleHelpful = () => {
    setIsHelpful((prev) => !prev);
    setHelpfulCount((prev) => (isHelpful ? prev - 1 : prev + 1));
  };

  return (
    <View className="mb-3 rounded-card bg-surface pt-1">
      <PostHeader
        userName={post.userName}
        userAvatarUrl={post.userAvatarUrl}
        timeAgo={post.timeAgo}
        onMenuPress={() => {}}
      />

      <Image source={{ uri: post.photoUrl }} className="h-56 w-full" />

      <PostEngagementRow
        helpfulCount={helpfulCount}
        repliesCount={post.repliesCount}
        isHelpful={isHelpful}
        onToggleHelpful={handleToggleHelpful}
      />

      <View className="flex-row flex-wrap gap-1 px-4 mb-2">
        {post.tags.map((tag) => {
          const color = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR;
          return (
            <View key={tag} className={`rounded-full px-2 py-0.5 ${color.bg}`}>
              <Text className={`text-[10px] font-medium ${color.text}`}>{tag}</Text>
            </View>
          );
        })}
      </View>

      <Text className="px-4 mb-3 text-sm text-text-primary">{post.comment}</Text>

      <BusinessPreviewCard
        msmeName={post.msmeName}
        msmeLocation={post.msmeLocation}
        msmeCategory={post.msmeCategory}
        msmePhotoUrl={post.msmePhotoUrl}
        onPress={() => {}}
      />
    </View>
  );
}