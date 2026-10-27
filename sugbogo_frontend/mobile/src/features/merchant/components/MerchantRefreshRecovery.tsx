import ErrorState from "@/shared/components/ErrorState";

type Props = {
  error: unknown;
  refetch: () => unknown;
  title?: string;
  description?: string;
};

/** Persistent recovery for a Merchant section while its usable cached content stays visible. */
export default function MerchantRefreshRecovery({
  error,
  refetch,
  title = "Unable to refresh business",
  description = "Previously loaded information is shown and may be out of date.",
}: Props) {
  if (!error) return null;
  return (
    <ErrorState
      size="section"
      title={title}
      description={description}
      primaryActionTitle="Retry"
      onPrimaryAction={() => {
        void refetch();
      }}
    />
  );
}
