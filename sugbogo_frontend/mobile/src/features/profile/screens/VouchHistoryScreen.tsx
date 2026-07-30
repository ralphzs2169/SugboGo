import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useState, useMemo } from "react";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import VouchHistoryItem from "@/features/profile/components/vouch-history/VouchHistoryItem";
import EditVouchModal from "@/features/profile/components/vouch-history/EditVouchModal";
import { theme } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MOCK_VOUCHES = [
  {
    id: "1",
    msmeName: "Danao Weaves & Crafts",
    photoUrl:
      "https://images.unsplash.com/photo-1528812969535-4bcefb361402?w=200&h=200&fit=crop",
    category: "Handicrafts",
    tag: "Heritage Craft",
    availableTags: ["Heritage Craft", "Artisanal Product", "Family Business"],
    date: "Jul 21, 2026",
  },
  {
    id: "2",
    msmeName: "Barako Brew Café",
    photoUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=200&fit=crop",
    category: "Café & Coffee",
    tag: "Local Ingredient",
    availableTags: [
      "Local Ingredient",
      "Traditional Recipe",
      "Family Business",
    ],
    date: "Jul 22, 2026",
  },
  {
    id: "3",
    msmeName: "Maribago Bluewater Spa",
    photoUrl:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&h=200&fit=crop",
    category: "Wellness & Spa",
    tag: "Nature Spot",
    availableTags: ["Nature Spot", "Artisanal Product"],
    date: "Jul 24, 2026",
  },
  {
    id: "4",
    msmeName: "Oslob Shell Craft Studio",
    photoUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop",
    category: "Souvenirs",
    tag: "Artisanal Product",
    availableTags: ["Artisanal Product", "Heritage Craft", "Family Business"],
    date: "Jul 25, 2026",
  },
  {
    id: "5",
    msmeName: "Carcar Lechon House",
    photoUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop",
    category: "Food & Dining",
    tag: "Traditional Recipe",
    availableTags: [
      "Traditional Recipe",
      "Local Ingredient",
      "Family Business",
    ],
    date: "Jul 26, 2026",
  },
];

export default function VouchHistoryScreen() {
  const [vouches, setVouches] = useState(MOCK_VOUCHES);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingVouchId, setEditingVouchId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();

  const filteredVouches = useMemo(() => {
    if (!searchQuery.trim()) return vouches;
    return vouches.filter((v) =>
      v.msmeName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [vouches, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const allSelected =
    filteredVouches.length > 0 && selectedIds.length === filteredVouches.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filteredVouches.map((v) => v.id));
  };

  const handleDeleteSelected = () => {
    setVouches((prev) => prev.filter((v) => !selectedIds.includes(v.id)));
    setSelectedIds([]);
    setIsEditing(false);
  };

  const handleTagChange = (newTag: string) => {
    setVouches((prev) =>
      prev.map((v) => (v.id === editingVouchId ? { ...v, tag: newTag } : v)),
    );
    setEditingVouchId(null);
  };

  const editingVouch = vouches.find((v) => v.id === editingVouchId);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "Vouch History",
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
          placeholder="Search vouched MSMEs..."
          placeholderTextColor={theme.extends.colors.text.tertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        contentContainerClassName="p-4 pb-24"
        data={filteredVouches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VouchHistoryItem
            msmeName={item.msmeName}
            photoUrl={item.photoUrl}
            category={item.category}
            tag={item.tag}
            date={item.date}
            isEditing={isEditing}
            isSelected={selectedIds.includes(item.id)}
            onSelect={() => toggleSelect(item.id)}
            onEdit={() => setEditingVouchId(item.id)}
            onDelete={() =>
              setVouches((prev) => prev.filter((v) => v.id !== item.id))
            }
          />
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-text-tertiary">
            No vouches yet.
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

      {editingVouch && (
        <EditVouchModal
          visible={!!editingVouchId}
          currentTag={editingVouch.tag}
          availableTags={editingVouch.availableTags}
          onConfirm={handleTagChange}
          onClose={() => setEditingVouchId(null)}
        />
      )}
    </View>
  );
}
