/** Displays the merchant's submitted explanation separately from Admin feedback. */
export default function MerchantChangeReason({ reason }) {
  if (!reason) return null;

  return (
    <section className="rounded-xl border border-stroke bg-background p-5">
      <h2 className="text-sm font-semibold text-text-primary">
        Merchant&apos;s reason for change
      </h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
        {reason}
      </p>
    </section>
  );
}
