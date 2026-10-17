import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { useState } from "react";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import PocketCard from "@/features/profile/components/pockets/PocketCard";
import { theme } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ErrorState from "@/shared/components/ErrorState";
import useMyPockets from "../hooks/useMyPockets";

export default function MyPocketsScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();

  const {
    pockets, isLoading, isRefetching, error, refetch, hasNextPage,
    fetchNextPage, isFetchingNextPage, isFetchNextPageError, removePockets, isRemoving,
  } = useMyPockets(searchQuery);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const allSelected =
    pockets.length > 0 && pockets.every((p) => selectedIds.includes(p.business_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pockets.map((p) => p.business_id));
    }
  };

  const handleRemove = async (businessIds: number[]) => {
    if (isRemoving) return;
    try {
      await removePockets(businessIds);
      setSelectedIds([]);
      setIsEditing(false);
    } catch {
      setSelectedIds([]);
      Alert.alert("Couldn't remove pockets", "Please try again. Successfully removed pockets will stay removed.");
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "My Pockets",
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

      <View className="flex-row items-center rounded-md bg-surface border-2 border-brand mx-4 mt-4 px-3 py-2">
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={theme.extends.colors.text.tertiary}
        />
        <TextInput
          className="ml-2 flex-1 text-sm text-text-primary"
          placeholder="Search saved MSMEs..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
          value={searchQuery}
          onChangeText={(value) => {
            setSearchQuery(value);
            setSelectedIds([]);
          }}
        />
      </View>

      <FlatList
        testID="my-pockets-list"
        contentContainerClassName="p-4 pb-24"
        data={pockets}
        keyExtractor={(item) => String(item.id)}
        refreshing={isRefetching && !isFetchingNextPage}
        onRefresh={() => { void refetch(); }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
        }}
        ListHeaderComponent={error && !isFetchNextPageError ? (
          <ErrorState
            title="Couldn't load pockets"
            description="Please check your connection and try again."
            size="small"
            primaryActionTitle="Retry"
            onPrimaryAction={() => { void refetch(); }}
          />
        ) : null}
        ListFooterComponent={isFetchingNextPage ? (
          <ActivityIndicator color={theme.extends.colors.brand} />
        ) : isFetchNextPageError ? (
          <ErrorState
            title="Couldn't load more pockets"
            description="Your saved pockets are still here. Try loading more again."
            size="small"
            primaryActionTitle="Load more"
            onPrimaryAction={() => { void fetchNextPage(); }}
          />
        ) : null}
        renderItem={({ item }) => (
          <PocketCard
            name={item.name}
            photoUrl={item.photo_url ?? ""}
            category={item.category}
            location={item.location}
            isEditing={isEditing}
            isSelected={selectedIds.includes(item.business_id)}
            onSelect={() => toggleSelect(item.business_id)}
            onRemove={() => { void handleRemove([item.business_id]); }}
            onPress={() => router.push({
              pathname: "/(explorer)/business/[businessId]",
              params: { businessId: item.business_id },
            })}
          />
        )}
        ListEmptyComponent={isLoading ? (
          <ActivityIndicator accessibilityLabel="Loading pockets" color={theme.extends.colors.brand} />
        ) : error ? null : (
          <Text className="mt-8 text-center text-text-tertiary">
            {searchQuery.trim() ? "No matching pockets." : "No saved pockets yet."}
          </Text>
        )}
      />

      {isEditing && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-surface px-4 border-t border-border"
          style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
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
            onPress={() => { void handleRemove(selectedIds); }}
            disabled={(selectedIds.length === 0 || isRemoving)}
            className={`rounded-md px-6 py-2 ${
              (selectedIds.length === 0 || isRemoving) ? "bg-disabled" : "bg-brand"
            }`}
          >
            <Text
              className={`font-semibold ${
                (selectedIds.length === 0 || isRemoving) ? "text-text-tertiary" : "text-white"
              }`}
            >
              {isRemoving ? "Deleting..." : "Delete"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
