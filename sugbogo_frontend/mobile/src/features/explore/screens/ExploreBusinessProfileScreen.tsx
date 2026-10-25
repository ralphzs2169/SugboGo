import { useLayoutEffect } from "react";

import { usePocketPicker } from "@/features/pockets/providers/PocketPickerContext";
import BusinessProfilePresentation from "../components/business-profile/BusinessProfilePresentation";
import useBusinessDetailSource from "../hooks/useBusinessDetailSource";
import useBusinessProfilePreview from "../hooks/useBusinessProfilePreview";
import type { BusinessProfileProps } from "./LiveBusinessProfile";

/** Resolves authority while preserving one recognizable profile shell across source changes. */
export default function ExploreBusinessProfileScreen(
  props: BusinessProfileProps,
) {
  const detail = useBusinessDetailSource(props.businessId);
  const preview = useBusinessProfilePreview(
    props.businessId,
    detail.isInitialLoading,
    props.previewQueryHash,
  );
  const picker = usePocketPicker();
  const closePicker = picker?.closePocketPicker;
  useLayoutEffect(() => {
    if (detail.source !== "live") closePicker?.(props.businessId);
  }, [detail.source, props.businessId, closePicker]);
  return (
    <BusinessProfilePresentation {...props} detail={detail} preview={preview} />
  );
}
