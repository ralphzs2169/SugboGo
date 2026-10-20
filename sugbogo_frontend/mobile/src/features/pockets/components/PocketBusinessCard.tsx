import type { ComponentProps } from "react";

import BusinessCard from "@/features/explore/components/new-businesses/BusinessCard";

import { usePocketPicker } from "../providers/PocketPickerContext";

type Props = Omit<
  ComponentProps<typeof BusinessCard>,
  "onPocketPress" | "pocketActionDisabled"
>;

/** Explicitly opts supported card placements into the shared Pocket picker. */
export default function PocketBusinessCard(props: Props) {
  const picker = usePocketPicker();
  if (!picker) return <BusinessCard {...props} />;
  return (
    <BusinessCard
      {...props}
      onPocketPress={() => picker.openPocketPicker(props.business.id)}
      pocketActionDisabled={picker.isOpen}
    />
  );
}
