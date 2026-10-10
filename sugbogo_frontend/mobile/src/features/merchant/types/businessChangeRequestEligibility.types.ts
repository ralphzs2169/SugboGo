export type BusinessChangeRequestEligibility = {
  can_submit: boolean;
  reason: "pending" | "cooldown" | null;
  cooldown_duration_hours: number;
  cooldown_until: string | null;
  last_approved_request_id: number | null;
  pending_request_id: number | null;
};
