import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";
import { TAXONOMY_SEARCH_THRESHOLD } from "@/shared/utils/taxonomyFilters";

import FilterSection from "./FilterSection";

type Props = {
  options: {
    clusters: { id: number; name: string; icon?: string | null }[];
    categories: { id: number; name: string; cluster_id: number }[];
    specialty_tags: (SpecialtyTag & { id: number })[];
  };
  clusterId: number | null;
  categoryIds: number[];
  specialtyTagId: number | null;
  query: string;
  onQueryChange: (query: string) => void;
  onClusterSelect: (id: number | null) => void;
  onCategoryToggle: (id: number) => void;
  onSpecialtySelect: (id: number | null) => void;
  specialtyTitle?: string;
  showEmptyStates?: boolean;
  highlightSearchMatches?: boolean;
  showIcons?: boolean;
  searchBackground?: "surface" | "muted";
};

/**
 * Renders controlled taxonomy choices inside existing filter sheets.
 * Draft state, selection rules, and sheet lifecycle stay with the feature.
 */
export default function TaxonomyFilterControls({
  options,
  clusterId,
  categoryIds,
  specialtyTagId,
  query,
  onQueryChange,
  onClusterSelect,
  onCategoryToggle,
  onSpecialtySelect,
  specialtyTitle = "Specialty",
  showEmptyStates = true,
  highlightSearchMatches = false,
  showIcons = false,
  searchBackground = "muted",
}: Props) {
  const normalizedQuery = query.trim().toLowerCase();
  const showSearch =
    options.categories.length + options.specialty_tags.length >
    TAXONOMY_SEARCH_THRESHOLD;
  const categories = useMemo(
    () =>
      options.categories.filter(
        (category) =>
          (clusterId === null || category.cluster_id === clusterId) &&
          category.name.toLowerCase().includes(normalizedQuery),
      ),
    [options.categories, clusterId, normalizedQuery],
  );
  const specialties = useMemo(
    () =>
      options.specialty_tags.filter((specialty) =>
        specialty.name.toLowerCase().includes(normalizedQuery),
      ),
    [options.specialty_tags, normalizedQuery],
  );

  return (
    <>
      {/* Optional search uses the containing bottom sheet's keyboard handling. */}
      {showSearch && (
        <View
          className={`mt-4 h-11 flex-row items-center rounded-full border border-border-primary px-4 ${
            searchBackground === "surface" ? "bg-surface" : "bg-surface-muted"
          }`}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={theme.extends.colors.text.tertiary}
          />
          <BottomSheetTextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search categories and specialties"
            placeholderTextColor={theme.extends.colors.text.tertiary}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search filters"
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 0,
              fontSize: 14,
              color: theme.extends.colors.text.primary,
            }}
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => onQueryChange("")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.extends.colors.text.tertiary}
              />
            </Pressable>
          )}
        </View>
      )}

      {/* Cluster selection */}
      <FilterSection title="Cluster" className="pt-5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 mt-3"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {[{ id: null, name: "All", icon: null }, ...options.clusters].map(
            (cluster) => (
              <FilterChip
                key={cluster.id ?? "all"}
                label={cluster.name}
                icon={
                  showIcons && cluster.icon
                    ? (CLUSTER_ICONS[cluster.icon] ?? "store")
                    : undefined
                }
                selected={clusterId === cluster.id}
                showSelectedCheck
                onPress={() => onClusterSelect(cluster.id)}
              />
            ),
          )}
        </ScrollView>
      </FilterSection>

      {/* Category selection */}
      <FilterSection
        title="Category"
        hint={categoryIds.length ? `${categoryIds.length} selected` : undefined}
      >
        <View className="mt-3 flex-row flex-wrap gap-2">
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              highlightQuery={
                highlightSearchMatches ? normalizedQuery : undefined
              }
              selected={categoryIds.includes(category.id)}
              showSelectedCheck
              onPress={() => onCategoryToggle(category.id)}
            />
          ))}
        </View>
        {categories.length === 0 && showEmptyStates && (
          <AppText className="mt-2 text-sm text-text-tertiary">
            {normalizedQuery
              ? `No categories match “${query.trim()}”.`
              : "No categories available."}
          </AppText>
        )}
      </FilterSection>

      {/* Specialty selection */}
      <FilterSection title={specialtyTitle} hint="Select one">
        <View className="mt-3 flex-row flex-wrap">
          <View className="mb-2 mr-2">
            <FilterChip
              label="Any specialty"
              selected={specialtyTagId === null}
              showSelectedCheck
              onPress={() => onSpecialtySelect(null)}
            />
          </View>
          {specialties.map((specialty) => (
            <SpecialtyTagChip
              key={specialty.id}
              tag={specialty}
              highlightQuery={
                highlightSearchMatches ? normalizedQuery : undefined
              }
              mode="filter"
              size="medium"
              showIcon={showIcons}
              isSelected={specialtyTagId === specialty.id}
              showSelectionIndicator
              onPress={() => onSpecialtySelect(specialty.id)}
            />
          ))}
        </View>
        {specialties.length === 0 && showEmptyStates && (
          <AppText className="mt-2 text-sm text-text-tertiary">
            {normalizedQuery
              ? `No specialties match “${query.trim()}”.`
              : "No specialties available."}
          </AppText>
        )}
      </FilterSection>
    </>
  );
}
