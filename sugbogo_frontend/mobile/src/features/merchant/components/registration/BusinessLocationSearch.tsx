import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import usePlaceSearch from "../../hooks/registration/usePlaceSearch";

type Props = {
  onPlaceSelect: (latitude: number, longitude: number, address: string) => void;
};

/**
 * Provides a searchable Google Places input for selecting a business location.
 *
 * Displays place suggestions as the user types and returns the selected
 * place's coordinates and formatted address to the parent component.
 */
export default function BusinessLocationSearch({ onPlaceSelect }: Props) {
  const [searchText, setSearchText] = useState("");

  const {
    suggestions,
    isLoading,
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  } = usePlaceSearch();

  async function handlePlaceSelect(placeId: string) {
    const place = await getPlaceDetails(placeId);

    if (!place) {
      return;
    }

    onPlaceSelect(place.latitude, place.longitude, place.address);

    setSearchText(place.address);
    clearSuggestions();
  }

  return (
    <View className="relative z-10 mb-3">
      <View className="h-[52px] flex-row items-center rounded-md bg-white px-4 border border-gray-300">
        <MaterialCommunityIcons name="magnify" size={22} color="#6B7280" />

        <TextInput
          value={searchText}
          onChangeText={(text) => {
            setSearchText(text);
            searchPlaces(text);
          }}
          placeholder="Search your business location"
          placeholderTextColor="#9CA3AF"
          className="ml-2 flex-1 text-[15px] text-gray-800"
        />

        {isLoading && <ActivityIndicator size="small" color="#1B4D3E" />}
      </View>

      {suggestions.length > 0 && (
        <View className="absolute left-0 right-0 top-[58px] overflow-hidden rounded-xl bg-white shadow-md">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => handlePlaceSelect(suggestion.placeId)}
              className="flex-row items-center border-b border-gray-100 px-4 py-3"
            >
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={20}
                color="#1B4D3E"
              />

              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-semibold text-gray-800">
                  {suggestion.mainText}
                </Text>

                {suggestion.secondaryText && (
                  <Text className="mt-0.5 text-[13px] text-gray-500">
                    {suggestion.secondaryText}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
