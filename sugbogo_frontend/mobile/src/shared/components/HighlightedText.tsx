import { memo, useMemo } from "react";

import AppText from "@/shared/components/AppText";

type Props = {
  text: string;
  query?: string | null;
  highlightTestID?: string;
};

/** Highlights literal text using the existing Frequently Mentioned treatment. */
function HighlightedText({
  text,
  query,
  highlightTestID = "literal-text-highlight",
}: Props) {
  const content = useMemo(() => {
    const phrase = query?.trim();

    if (!phrase) {
      return text;
    }

    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = new RegExp(`(${escaped})`, "gi");

    return text.split(matcher).map((part, index) =>
      part.toLocaleLowerCase() === phrase.toLocaleLowerCase() ? (
        <AppText
          key={`${index}-${part}`}
          testID={highlightTestID}
          weight="extrabold"
          className="rounded-sm  text-brand"
        >
          {part}
        </AppText>
      ) : (
        part
      ),
    );
  }, [text, query, highlightTestID]);

  return <>{content}</>;
}

export default memo(HighlightedText);
