import { createColumnHelper } from "@tanstack/react-table";
import { Eye } from "lucide-react";

import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/utils/dateUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";

const columnHelper = createColumnHelper();

const REQUEST_TYPE_LABELS = {
  business_name: "Business Name Change",
  classification: "Classification & Specialties",
  location: "Location & Landmarks",
};

/** Builds the compact Admin queue columns for the selected update-request type. */
export default function businessUpdateRequestColumns(onView) {
  return [
    columnHelper.display({
      id: "business",
      header: "Business",
      size: 250,
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-text-primary">
            {row.original.current_business_name}
          </p>
          <p className="text-xs text-text-secondary">
            {row.original.request_type === "location"
              ? row.original.proposed?.location?.address ||
                "Address unavailable"
              : `Business #${row.original.business_id}`}
          </p>
        </div>
      ),
    }),
    columnHelper.display({
      id: "requestType",
      header: "Request Type",
      size: 190,
      enableSorting: false,
      cell: ({ row }) =>
        REQUEST_TYPE_LABELS[row.original.request_type] || "Update Request",
    }),
    columnHelper.display({
      id: "merchant",
      header: "Requested By",
      size: 220,
      enableSorting: false,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-text-primary">
            {row.original.merchant?.name || row.original.merchant?.email || "—"}
          </p>
          <p className="text-xs text-text-secondary">
            {row.original.merchant?.email}
          </p>
        </div>
      ),
    }),
    columnHelper.display({
      id: "submitted",
      header: "Submitted",
      size: 180,
      enableSorting: false,
      cell: ({ row }) => formatDateTime(row.original.submitted_at),
    }),
    columnHelper.display({
      id: "status",
      header: "Status",
      size: 130,
      enableSorting: false,
      cell: ({ row }) => (
        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[row.original.status]}
        >
          {row.original.status.charAt(0).toUpperCase() +
            row.original.status.slice(1)}
        </StatusBadge>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: "Action",
      size: 110,
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="action"
          size="sm"
          icon={Eye}
          onClick={() => onView(row.original)}
        >
          Review
        </Button>
      ),
    }),
  ];
}
