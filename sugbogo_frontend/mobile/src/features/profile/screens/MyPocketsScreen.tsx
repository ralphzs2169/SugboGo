import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useState, useMemo } from "react";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import PocketCard from "@/features/profile/components/pockets/PocketCard";
import { theme } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MOCK_POCKETS = [
  {
    id: "1",
    name: "Lola Nena's Bakeshop",
    photoUrl:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=200&h=200&fit=crop",
    category: "Culinary",
    location: "Colon St, Cebu City",
  },
  {
    id: "2",
    name: "Danao Weaves & Crafts",
    photoUrl:
      "https://images.unsplash.com/photo-1528812969535-4bcefb361402?w=200&h=200&fit=crop",
    category: "Creative",
    location: "Danao City, Cebu",
  },
  {
    id: "3",
    name: "Barako Brew Café",
    photoUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&h=200&fit=crop",
    category: "Culinary",
    location: "IT Park, Lahug",
  },
  {
    id: "4",
    name: "Oslob Souvenir House",
    photoUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop",
    category: "Creative",
    location: "Oslob, Cebu",
  },
  {
    id: "5",
    name: "Bohol Bee Farm",
    photoUrl:
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200&h=200&fit=crop",
    category: "Experiential",
    location: "Panglao, Bohol",
  },
];

export default function MyPocketsScreen() {
  const [pockets, setPockets] = useState(MOCK_POCKETS);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const insets = useSafeAreaInsets();

  const filteredPockets = useMemo(() => {
    if (!searchQuery.trim()) return pockets;
    return pockets.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [pockets, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const allSelected =
    filteredPockets.length > 0 && selectedIds.length === filteredPockets.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPockets.map((p) => p.id));
    }
  };

  const handleDeleteSelected = () => {
    setPockets((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
    setIsEditing(false);
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
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        contentContainerClassName="p-4 pb-24"
        data={filteredPockets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PocketCard
            name={item.name}
            photoUrl={item.photoUrl}
            category={item.category}
            location={item.location}
            isEditing={isEditing}
            isSelected={selectedIds.includes(item.id)}
            onSelect={() => toggleSelect(item.id)}
            onRemove={() =>
              setPockets((prev) => prev.filter((p) => p.id !== item.id))
            }
            onPress={() => {}}
          />
        )}
        ListEmptyComponent={
          <Text className="mt-8 text-center text-text-tertiary">
            No saved pockets yet.
          </Text>
        }
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
