import { ArrowRightLeft, BusFront, MapPin } from "lucide-react";

import TableTabs from "@/features/admin-panel/components/data-table/TableTabs";

const CONTEXT_TABS = [
  { id: "routes", label: "Routes", icon: BusFront },
  { id: "transit-points", label: "Transit Points", icon: MapPin },
  { id: "transfers", label: "Transfers", icon: ArrowRightLeft },
];

/**
 * Provides persistent URL-backed navigation between major transit network
 * contexts while editing modes remain local to each context.
 */
export default function TransitNetworkNavigation({ context, onChange }) {
  return (
    <nav aria-label="Transit Network sections">
      {/* Network context tabs */}
      <TableTabs
        tabs={CONTEXT_TABS}
        activeTab={context}
        onTabChange={onChange}
      />
    </nav>
  );
}
