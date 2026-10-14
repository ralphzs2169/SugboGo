import { Navigate, useParams } from "react-router-dom";

export default function ReviewDisputeDetailPage() {
  const { disputeId } = useParams();

  return (
    <Navigate
      to={`/admin-panel/moderation-integrity?tab=disputes&dispute_id=${encodeURIComponent(disputeId)}`}
      replace
    />
  );
}
