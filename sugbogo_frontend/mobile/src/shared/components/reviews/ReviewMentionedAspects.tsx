import { ScrollView, View } from "react-native";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";

/** Shares evidence-backed topic chips between Explorer and Merchant review feeds. */
export default function ReviewMentionedAspects({
  mentions,
  selected,
  onChange,
}: {
  mentions: { label: string; count: number }[];
  selected: string | null;
  onChange: (topic: string | null) => void;
}) {
  if (!mentions.length && !selected) return null;
  return (
    <View>
      <AppText weight="bold" className="mb-3 text-sm text-text-primary">
        Frequently mentioned
      </AppText>
      <ScrollView
        testID="review-topic-filters"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-2 px-1 pr-3"
      >
        {mentions.map((mention) => (
          <FilterChip
            key={mention.label}
            label={mention.label}
            count={mention.count}
            selected={selected === mention.label}
            onPress={() =>
              onChange(selected === mention.label ? null : mention.label)
            }
            accessibilityLabel={
              mention.label +
              ", mentioned in " +
              mention.count +
              (mention.count === 1 ? " review" : " reviews") +
              (selected === mention.label ? ", selected" : "")
            }
          />
        ))}
        {selected &&
          !mentions.some((mention) => mention.label === selected) && (
            <FilterChip
              label={selected}
              selected
              icon="close"
              onPress={() => onChange(null)}
              accessibilityLabel="Remove mentioned aspect filter"
            />
          )}
      </ScrollView>
    </View>
  );
}
