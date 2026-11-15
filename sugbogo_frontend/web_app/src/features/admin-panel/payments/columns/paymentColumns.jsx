import { createColumnHelper } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDate from "../../all-reviews/components/ReviewDate";
import PaymentBadge from "../components/PaymentBadge";
import { paymentAmount } from "../utils/paymentPresentation";

const column = createColumnHelper();

/** Match the shared management table's identity cells, status chips, and View interaction. */
export default function paymentColumns(onView) {
  return [
    column.display({
      id: "reference",
      header: "Reference",
      size: 235,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0 space-y-2">
          <p
            title={row.original.reference}
            className="truncate text-xs font-medium leading-5 text-text-primary"
          >
            {row.original.reference}
          </p>
          {row.original.needs_review && (
            <StatusBadge variant="dangerSoft">Needs review</StatusBadge>
          )}
        </div>
      ),
    }),
    column.display({
      id: "merchant",
      header: "Merchant / Business",
      size: 260,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0 space-y-1">
          <p
            className="truncate text-sm font-bold text-text-primary"
            title={row.original.business.name}
          >
            {row.original.business.name}
          </p>
          <p
            className="truncate text-sm text-text-primary"
            title={row.original.merchant.name}
          >
            {row.original.merchant.name}
          </p>
          <p
            className="truncate text-xs text-text-secondary"
            title={row.original.merchant.email}
          >
            {row.original.merchant.email}
          </p>
        </div>
      ),
    }),
    ...[
      ["provider", "Provider", 100],
      ["mode", "Mode", 90],
    ].map(([key, header, size]) =>
      column.display({
        id: key,
        header,
        size,
        meta: { skeleton: "text" },
        cell: ({ row }) => <PaymentBadge value={row.original[key]} />,
      }),
    ),
    column.display({
      id: "amount",
      header: "Amount",
      size: 95,
      meta: { skeleton: "text" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-text-primary">
          {paymentAmount(row.original.amount_centavos, row.original.currency)}
        </span>
      ),
    }),
    ...[
      ["financial_status", "Financial", 110],
      ["fulfilment_status", "Fulfilment", 140],
      ["checkout_outcome", "Checkout outcome", 140],
    ].map(([key, header, size]) =>
      column.display({
        id: key,
        header,
        size,
        meta: { skeleton: "text" },
        cell: ({ row }) => <PaymentBadge value={row.original[key]} />,
      }),
    ),
    column.display({
      id: "created",
      header: "Created",
      size: 155,
      meta: { skeleton: "text" },
      cell: ({ row }) => <ReviewDate value={row.original.created_at} />,
    }),
    column.display({
      id: "actions",
      header: "Actions",
      size: 95,
      meta: { skeleton: "button" },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Inspect payment ${row.original.reference}`}
          onClick={() => onView(row.original.id)}
        >
          <Eye aria-hidden="true" className="h-4 w-4" /> View
        </Button>
      ),
    }),
  ];
}
