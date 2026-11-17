import { createColumnHelper } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import ReviewDate from "../../all-reviews/components/ReviewDate";
import BusinessImage from "../../businesses/components/business-detail/BusinessImage";
import PaymentBadge from "../components/PaymentBadge";
import {
  checkoutOutcomeState,
  financialState,
  fulfilmentState,
  paymentAmount,
} from "../utils/paymentPresentation";

const column = createColumnHelper();

/** Match the shared management table's identity cells, status chips, and View interaction. */
export default function paymentColumns(onView) {
  return [
    column.display({
      id: "rowNumber",
      header: "No.",
      size: 60,
      meta: { skeleton: "number" },
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return pageIndex * pageSize + row.index + 1;
      },
    }),
    column.display({
      id: "merchant",
      header: "Merchant / Business",
      size: 260,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const { business, merchant } = row.original;
        return (
          <div className="flex min-w-0 items-start gap-2.5">
            <BusinessImage
              src={business.cover_photo_url}
              alt=""
              fallback=""
              className="h-10 w-10 shrink-0 rounded-lg border border-stroke"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary" title={business.name}>
                {business.name}
              </p>
              <p className="truncate text-sm text-text-primary" title={merchant.name}>
                {merchant.name}
              </p>
              <p className="truncate text-xs text-text-secondary" title={merchant.email}>
                {merchant.email}
              </p>
            </div>
          </div>
        );
      },
    }),
    ...[
      ["provider", "Provider", 100],
      ["mode", "Environment", 115],
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
      size: 80,
      meta: { skeleton: "text" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm font-medium tabular-nums text-text-primary">
          {paymentAmount(row.original.amount_centavos, row.original.currency)}
        </span>
      ),
    }),
    ...[
      ["financial_status", "Financial", 125, financialState],
      ["fulfilment_status", "Fulfilment", 135, fulfilmentState],
    ].map(([key, header, size, status]) =>
      column.display({
        id: key,
        header,
        size,
        meta: { skeleton: "text" },
        cell: ({ row }) => (
          <PaymentBadge value={status(row.original[key], row.original)} />
        ),
      }),
    ),
    column.display({
      id: "checkout_outcome",
      header: "Checkout outcome",
      size: 160,
      meta: { skeleton: "text" },
      cell: ({ row }) => {
        const payment = row.original;
        const outcome = checkoutOutcomeState(
          payment.checkout_outcome,
          payment.financial_status,
          payment.checkout_state,
        );
        return (
          <div className="flex flex-col items-start gap-1">
            <PaymentBadge value={outcome} />
            {payment.needs_review === true && (
              <StatusBadge variant="dangerSoft">Needs review</StatusBadge>
            )}
          </div>
        );
      },
    }),
    column.display({
      id: "created",
      header: "Created",
      size: 125,
      meta: { skeleton: "text" },
      cell: ({ row }) => <ReviewDate value={row.original.created_at} />,
    }),
    column.display({
      id: "actions",
      header: "Actions",
      size: 85,
      meta: { skeleton: "button" },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Inspect payment ${row.original.reference}`}
          onClick={() => onView(row.original.id)}
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
        </Button>
      ),
    }),
  ];
}
