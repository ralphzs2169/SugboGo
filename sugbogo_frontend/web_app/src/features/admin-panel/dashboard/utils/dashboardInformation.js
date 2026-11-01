import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Clock,
  Database,
  History,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Store,
  ThumbsUp,
  Timer,
  Users,
} from "lucide-react";

// Dashboard explanations use the same icon-led heading blocks as AnalyticsReportExplanation.
export const dashboardInformation = {
  "Platform Overview": [
    {
      icon: Users,
      heading: "Current account status",
      text: "Active Accounts counts Explorer and Merchant accounts with active stored account status. It does not measure recent engagement and excludes administrative roles.",
    },
    {
      icon: Store,
      heading: "Current business inventory",
      text: "Active Businesses counts business records with active status, independently of owner account status or verification.",
    },
    {
      icon: CalendarDays,
      heading: "Seven-day events",
      text: "Reviews Published counts recorded first publications. Vouches Created counts retained vouch records by original creation time. These use the selected Manila reporting window; current inventory counts do not.",
    },
  ],
  "Administrative Queues": [
    {
      icon: ClipboardList,
      heading: "Open workflow records",
      text: "Applications are submitted applications awaiting review. Changes combines pending name, classification, and location requests. Disputes counts pending merchant review disputes.",
    },
    {
      icon: ShieldCheck,
      heading: "Reviews and reported cases",
      text: "Reviews under review includes automated moderation and recovery processing. Reported reviews counts distinct reviews with at least one pending report, not individual report submissions.",
    },
    {
      icon: AlertTriangle,
      heading: "Categories may overlap",
      text: "A review can belong to more than one workflow. Queue counts are not a combined outstanding-work total, and not every review under review requires manual intervention.",
    },
  ],
  "Platform Activity Trend": [
    {
      icon: CalendarDays,
      heading: "Reporting window",
      text: "Seven Manila calendar dates, including the current partial day. Events are counted from local midnight six dates before today through the captured Data as of timestamp, start-inclusive and end-exclusive.",
    },
    {
      icon: ClipboardList,
      heading: "Applications submitted",
      definition: "applications_submitted",
    },
    {
      icon: MessageSquareText,
      heading: "Reviews published",
      definition: "reviews_published",
    },
    {
      icon: ThumbsUp,
      heading: "Vouches created",
      definition: "vouches_created",
    },
    {
      icon: Activity,
      heading: "Read and compare recorded events",
      text: "Counts reflect retained, recorded events, not distinct users. Legend totals are the API's seven-day totals. Select a series to isolate it on the shared count axis; select it again or choose Show all series to restore the chart. No previous-period comparison is provided.",
    },
  ],
  "User Distribution": [
    {
      icon: Users,
      heading: "Registered accounts by current role",
      text: "Each account is counted once under its current assigned role. Merchants are not also counted as Explorers. Unknown role values remain visible when present.",
    },
    {
      icon: Database,
      heading: "All account statuses",
      text: "Includes all registered account statuses, including non-active accounts. This is account composition, not active engagement or a seven-day activity measure.",
    },
  ],
  "Priority Worklist": [
    {
      icon: ListChecks,
      heading: "Up to five pending cases",
      text: "This is a limited selection, not the complete backlog. It includes applications, change requests, reviews under review, reported-review cases, and disputes.",
    },
    {
      icon: AlertTriangle,
      heading: "Backend priority ordering",
      text: "Overdue submitted applications come first, followed by approaching applications. Remaining pending work follows its recorded queue-entry time. Unknown application ages are never treated as overdue.",
    },
    {
      icon: Clock,
      heading: "Separate workflows and timestamps",
      text: "A review may appear separately in moderation and reported-review workflows. Report counts are pending reports for that case. Row timestamps retain each workflow's recorded meaning and are displayed in Manila time.",
    },
  ],
  "Application Review Aging": [
    {
      icon: Timer,
      heading: "Elapsed weekdays",
      text: "On time: 0–2 weekdays. Approaching deadline: 3–4 weekdays. Overdue: 5 or more weekdays. The backend excludes the submission day and weekends; no holiday adjustment is applied.",
    },
    {
      icon: ClipboardList,
      heading: "Submitted applications only",
      text: "The distribution includes submitted applications awaiting review. Unknown ages stay separate and remain included in the total; missing or future timestamps are not assigned fabricated ages.",
    },
  ],
  "Recent Administrative Decisions": [
    {
      icon: History,
      heading: "Latest five supported recorded decisions",
      text: "Application reviews and explicitly supported administrative activity are merged in recorded timestamp order. The feed is not a complete audit history of every platform action.",
    },
    {
      icon: Users,
      heading: "Recorded administrators and current labels",
      text: "Administrator attribution follows the recorded reviewer or actor. Entity labels may reflect current records rather than historical snapshots. Unavailable actors or deleted entities use safe fallback labels; timestamps are shown in Manila time.",
    },
  ],
  "Discovery Score Health": [
    {
      icon: Database,
      heading: "Authoritative Analytics coverage",
      text: "Coverage monitors active businesses. Fresh means a non-provisional computed score within the established 26-hour freshness threshold, without a pending refresh request or recorded error marker. Stale means an older non-provisional score.",
    },
    {
      icon: Activity,
      heading: "Recorded processing conditions",
      text: "Pending means a recorded refresh-request timestamp exists. Failed means a recorded error marker, which may be historical. Missing means no score record; Provisional identifies an initialized provisional score.",
    },
    {
      icon: AlertTriangle,
      heading: "Limits of the snapshot",
      text: "Coverage counters may overlap and must not be summed. Score freshness and zero error markers do not independently establish scheduled-job success or overall system health. Data as of uses the coverage snapshot timestamp.",
    },
  ],
};
