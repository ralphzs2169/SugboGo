import { useContext, useEffect, useRef, type ComponentProps } from "react";
import type { View } from "react-native";

import BusinessCard from "@/features/explore/components/new-businesses/BusinessCard";
import { useExplorerTour } from "@/features/guided-tour/hooks/useExplorerTour";
import { BookmarkTourSurfaceContext } from "@/features/guided-tour/hooks/useBookmarkTourSurface";

import { usePocketPicker } from "../providers/PocketPickerContext";

type Props = Omit<
  ComponentProps<typeof BusinessCard>,
  | "onPocketPress"
  | "pocketActionDisabled"
  | "pocketActionRef"
  | "onPocketActionLayout"
>;

/** Explicitly opts supported card placements into the shared Pocket picker. */
export default function PocketBusinessCard(props: Props) {
  const picker = usePocketPicker();
  const tour = useExplorerTour()?.bookmark;
  const surface = useContext(BookmarkTourSurfaceContext);
  const action = useRef<View>(null);
  const businessId = props.business.id;
  const canRegister =
    Boolean(picker && !picker.isOpen && surface && !surface.blocked && tour) &&
    Number.isSafeInteger(businessId) &&
    businessId > 0;

  useEffect(() => {
    if (!canRegister || !surface || !action.current) return;
    return tour?.register({ node: action.current, surface });
  }, [businessId, canRegister, surface, tour]);

  if (!picker) return <BusinessCard {...props} />;
  return (
    <BusinessCard
      {...props}
      onPocketPress={() => picker.openPocketPicker(props.business.id)}
      pocketActionDisabled={picker.isOpen}
      pocketActionRef={canRegister ? action : undefined}
      onPocketActionLayout={canRegister ? tour?.refresh : undefined}
    />
  );
}
