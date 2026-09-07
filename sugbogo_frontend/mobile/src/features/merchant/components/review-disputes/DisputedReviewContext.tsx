import { Image } from "expo-image";
import { Text, View } from "react-native";

import Avatar from "@/shared/components/Avatar";
import { formatDate } from "@/shared/utils/date.utils";

import type { DisputedReview } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  review: DisputedReview;
};

/** Presents the immutable review snapshot attached to a dispute case. */
export default function DisputedReviewContext({ review }: Props) {
  return (
    <View className="rounded-card border border-border-primary bg-surface p-4">
      {/* Reviewer identity */}
      <View className="flex-row items-center">
        <Avatar imageUrl={review.author.avatar_url} size={40} />

        <View className="ml-3 flex-1">
          <Text className="font-semibold text-text-primary" numberOfLines={1}>
            {review.author.first_name} {review.author.last_name}
          </Text>

          <Text className="mt-0.5 text-xs text-text-secondary">
            Reviewed {formatDate(review.created_at)}
          </Text>
        </View>
      </View>

      {/* Review content */}
      <Text className="mt-4 text-sm leading-6 text-text-primary">
        {review.text}
      </Text>

      {review.photos.length > 0 && (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {review.photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.photo_url }}
              className="aspect-square w-[31%] rounded-xl bg-surface-secondary"
              contentFit="cover"
            />
          ))}
        </View>
      )}
    </View>
  );
}
