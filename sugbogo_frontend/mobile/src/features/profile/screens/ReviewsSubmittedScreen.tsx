import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useState, useMemo } from "react";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ReviewCard from "@/features/profile/components/reviews/ReviewCard";
import { theme } from "@/constants/theme";

const MOCK_REVIEWS = [
  {
    id: "1",
    msmeName: "Lola Nena's Bakeshop",
    category: "Food & Bakery",
    comment:
      "Absolutely love this place! The pan de sal here is the softest I've ever tasted — warm, fluffy, and perfectly golden. The ensaymada is also a must-try.",
    date: "Jul 20, 2026",
    photoUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=200&fit=crop",
  },
  {
    id: "2",
    msmeName: "Danao Weaves & Crafts",
    category: "Handicrafts",
    comment:
      "A hidden gem for anyone who appreciates traditional Filipino craftsmanship. The woven bags and baskets are beautifully made and reasonably priced.",
    date: "Jul 21, 2026",
  },
];

export default function ReviewsSubmittedScreen() {
  const [reviews, setReviews] = useState(MOCK_REVIEWS);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    return reviews.filter((r) =>
      r.msmeName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [reviews, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const allSelected =
    filteredReviews.length > 0 && selectedIds.length === filteredReviews.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filteredReviews.map((r) => r.id));
  };

  const handleDeleteSelected = () => {
    setReviews((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setIsEditing(false);
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "My Reviews",
          headerRight: () => (
            <Pressable
              onPress={() => {
                setIsEditing((prev) => !prev);
                setSelectedIds([]);
              }}
            >
              <Text className="text-brand font-semibold">
                {isEditing ? "Done" : "Edit"}
              </Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-row items-center rounded-md bg-surface border border-brand mx-4 mt-4 px-3 py-2">
        <MaterialCommunityIcons
          name="magnify"
          size={18}
          color={theme.extends.colors.text.tertiary}
        />
        <TextInput
          className="ml-2 flex-1 text-sm text-text-primary"
          placeholder="Search by MSME name..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        contentContainerClassName="p-4 pb-24"
        data={filteredReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            msmeName={item.msmeName}
            category={item.category}
            comment={item.comment}
            date={item.date}
            photoUrl={item.photoUrl}
            isEditing={isEditing}
            isSelected={selectedIds.includes(item.id)}
            onSelect={() => toggleSelect(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-text-tertiary">
            No reviews submitted yet.
          </Text>
        }
      />

      {isEditing && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-surface px-4 pt-4 border-t border-border"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={toggleSelectAll}
            className="flex-row items-center"
            hitSlop={8}
          >
            <View
              className={`mr-2 h-5 w-5 items-center justify-center rounded border ${
                allSelected ? "bg-brand border-brand" : "border-border"
              }`}
            >
              {allSelected && (
                <MaterialCommunityIcons
                  name="check"
                  size={14}
                  color="#FFFFFF"
                />
              )}
            </View>
            <Text className="text-text-primary">All</Text>
          </Pressable>

          <Pressable
            onPress={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`rounded-md px-6 py-2 ${
              selectedIds.length === 0 ? "bg-disabled" : "bg-brand"
            }`}
          >
            <Text
              className={`font-semibold ${
                selectedIds.length === 0 ? "text-text-tertiary" : "text-white"
              }`}
            >
              Delete
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
