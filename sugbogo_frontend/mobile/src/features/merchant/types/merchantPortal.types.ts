import { MerchantRegistrationStatus } from "./merchant.types";

export type MerchantPortalPrimaryAction =
  | "START_REGISTRATION"
  | "CONTINUE_REGISTRATION"
  | "VIEW_APPLICATION"
  | "OPEN_DASHBOARD";

/**
 * Registration progress displayed while the application
 * is in the draft state.
 */
export interface RegistrationProgress {
  currentStep: number;
  totalSteps: number;
  lastUpdated: string;
}

/**
 * Application review information displayed while
 * the application is under review.
 */
export interface ApplicationStatus {
  status: "UNDER_REVIEW";
  submittedAt: string;
  estimatedReview: string;
}

/**
 * Administrator feedback shown when an application
 * requires revisions.
 */
export interface RejectionFeedback {
  reviewedAt: string;
  feedback: string[];
}

/**
 * Merchant information displayed after approval.
 */
export interface MerchantDashboard {
  businessName: string;
  approvedAt: string;
}

/**
 * State returned by the Merchant Portal hook.
 */
export interface MerchantPortalState {
  registrationStatus: MerchantRegistrationStatus;

  primaryAction: MerchantPortalPrimaryAction;

  progress?: RegistrationProgress;

  application?: ApplicationStatus;

  feedback?: RejectionFeedback;

  merchant?: MerchantDashboard;
}
