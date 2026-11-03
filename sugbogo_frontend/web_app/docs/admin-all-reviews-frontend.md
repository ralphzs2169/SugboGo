# Admin All Reviews frontend

Implemented route: `/admin-panel/reviews`.

## 1. Existing patterns reused

The page uses the existing `PageHeader`, Businesses `DataTable` and TanStack columns,
`FilterMenu`, `SortMenu`, `TablePagination`, table skeleton/error/empty components,
compact `MetricCard`, `UserAvatar`, `StatusBadge`, guarded `BusinessImage`, and
`ReviewPhotoViewerModal`. Data uses the existing Axios client, React Query, URL state,
and 400 ms `useDebounce`. Colors, spacing, typography, borders, and theme tokens come
from the existing Admin implementation.

The shared Modal has an optional right placement. Its default remains a centered
modal. Escape belongs to the active nested dialog, and body scrolling restores its
previous state. Shared table additions provide an accessible table name, configurable
minimum width, a search accessible name, and wrapping controls.

## 2. Page structure

Page header and inspection description → global metric cards → search/filter/sort
controls → eight-column reviews table → standard pagination → on-demand details
drawer. The sidebar places All Reviews under Management. The route stays inside the
existing `ProtectedRoute`; sidebar visibility uses the existing Admin/Super Admin roles.

## 3. Metric cards

The summary request is independent of the list and receives no list parameters.
All values come from `/admin/reviews/summary/` through the existing `/api` client base.
Cards display Total Reviews, Published, Under Review, and Reported using their exact
documented fields. Copy explains that counts overlap and Reported includes resolved
and withdrawn reports. There are no charts, fabricated trends, or percentages.

Published and Under Review apply the respective status; Reported applies `reported=true`.
Total clears only status/report criteria. Other criteria remain intact. Each action
returns to page one. This follows the existing clickable Business metric pattern.

## 4. Search, filtering, and sorting

Only `search`, `status`, `reported`, `start_date`, `end_date`, `ordering`, `page`, and
`page_size` are sent to the list endpoint. `review_id` is a UI-only drawer selection
and never goes to the list API.

Search is debounced for 400 ms; changes wait for the debounce before issuing the new
list request. Status supports `published`, `under_review`, `flagged`, and `rejected`.
Reported offers reported, not reported, and omitted/all; the literal string `false`
is preserved. A custom date popover validates and applies both date bounds together.
Dates remain `YYYY-MM-DD` values for the backend's inclusive Manila filtering.
Ordering is `newest` or `oldest`. All search/filter/sort changes reset page one.

Clear Filters removes criteria and restores newest ordering while retaining page size.
Page sizes are 10, 25, 50, or 100; valid direct-URL sizes are also represented. Row
numbering uses the backend page/page-size metadata. Out-of-range pages have a
Return to first page recovery action that preserves filters.

## 5. Exact table columns

| Column | Contents |
| --- | --- |
| No. | `(page - 1) * page_size + row.index + 1` |
| Review | Two-line text preview, first-photo thumbnail or text-review placeholder, singular/plural photo count or Text only |
| Reviewer | Supplied avatar/default SugboGo avatar, Admin display name, email when present |
| Business | Supplied cover image or placeholder, name, category/cluster secondary line |
| Status | Existing badge with the exact current status and readable theme text |
| Reports | No reports or total retained reports; a separate pending count when positive |
| Submitted | Date above time, explicitly formatted in Asia/Manila and labeled PHT |
| Actions | Named eye/View button that opens inspection |

There is no empty overflow menu. Authoritative moderation links are available only
in detail, so the row does not infer decision eligibility. Table rendering makes no
per-row detail/business/reporter requests. Long names, emails, classification, and
review text are constrained to the established cell density.

## 6. Drawer sections

- Review ID and current status.
- Applicable Moderation destinations, clearly distinguished by purpose.
- Full text and every supplied photo, with the existing keyboard-accessible photo
  viewer and guarded missing/failed-image presentation.
- Submitted, published, edited, and updated timestamps when supplied. Updated is not
  relabeled as an author edit.
- Reviewer identity, uploaded/default avatar, and supplied Admin-visible email.
- Business name, representative image, category, and cluster.
- All retained reports: reason, status, creation/update/withdrawal times, explanation,
  and existing administrator notes. No reporter identity is inferred or rendered.
- Stored sentiment label/score and summarized moderation outcome/check time, including
  unavailable/incomplete checks. Copy distinguishes stored analysis from current status.
- Existing decision history, newest first, with action, actor, timestamp, recorded
  previous/resulting statuses, and notes. Empty history produces no invented events.

There are no moderation decision controls, AI-processing actions, star ratings,
device/integrity fields, or raw model/provider payloads.

## 7. Moderation navigation

Only non-null, recognized `moderation_links` from detail produce navigation. IDs are
extracted from the supplied API target, including the dispute's own case ID; they are
not inferred from review status/report totals. Destinations use existing selections:

| Supplied key | Existing frontend target |
| --- | --- |
| `under_review` | `/admin-panel/moderation-integrity?tab=under-review&under_review_id=<supplied ID>` |
| `reported_review` | `/admin-panel/moderation-integrity?tab=reported&reported_id=<supplied ID>` |
| `review_dispute` | `/admin-panel/moderation-integrity?tab=disputes&dispute_id=<supplied case ID>` |

All valid destinations remain visible when more than one is available. Unknown paths,
null values, and external URLs do not produce a fallback or speculative action.
Existing moderation components already read these selection parameters independently
of the currently displayed queue page, including manually resolved review details.

## 8. Data and recovery states

Summary, list, and detail have independent query keys and error/retry states. Summary
has four metric skeletons and can retain earlier counts after a refresh error. Table
skeletons retain all eight columns. Initial drawer loading stays inside the drawer;
detail errors offer retry plus the persistent close control. Removed reviews receive
specific unavailable copy. No reviews yet and no matching criteria use different copy;
filtered emptiness includes a reset action.

Requests consume React Query cancellation signals. List pages do not use previous-page
placeholder rows, avoiding incorrect numbering while fetching. Details are keyed by ID,
without previous-review placeholder data. Cached same-ID details revalidate on reopen.
Summary revalidates on mount, including returning from Moderation; paging does not
refetch it. Existing query-cache policies handle retries and deduplication.

## 9. Responsive behavior and accessibility

The table keeps a 1,430 px minimum width inside the existing horizontal scroll area;
rich cells remain readable. Controls wrap rather than widening the document. Metrics
use the existing one/two/four-column responsive grid. The drawer fills available width
up to `max-w-3xl`, keeps its heading/close control fixed, and scrolls its body.

Controls have names/labels, View buttons include review IDs, and the table has an
accessible name. Status meaning is text as well as color. Existing soft badge fills
and dots are preserved with primary theme text for readability, and pending report
text avoids low-contrast warning-colored text. Dates use semantic `time` elements.
Decorative images/icons are silent; meaningful photos have alternatives. Existing
modal/media focus trapping, Escape, focus restoration, and scroll locking are reused.

## 10. Tests

`all-reviews/tests/AllReviewsPage.test.js` adds 27 Node/Vite/JSDOM tests following the
existing Admin test architecture. Coverage includes rendering/navigation/roles, exact
summary/list transport envelopes, independent metrics, clickable cards, all table
statuses, missing media/avatars, reports, Manila dates, search debounce, status/report/
date/order filters, pagination/page size/row numbering, reset, loading/errors/retries,
empty states, on-demand details, full inspection content, report privacy, photos,
stored analysis/history, exact moderation links/navigation, reopening, cancellation,
stale results, nested Escape, focus restoration, and out-of-range pagination recovery.

Fixtures are test-only and are not imported by production components or services.
No existing tests were changed or weakened.

## 11. Validation results

- All 27 All Reviews tests pass.
- All 23 existing Business action and Business metric tests pass.
- Targeted ESLint reports zero errors. The existing TanStack `useReactTable`
  React Compiler compatibility warning remains in the shared DataTable.
- The production Vite build passes. Existing Lottie direct-eval and bundle-size
  warnings remain. There is no separate TypeScript/type-check script in this JS app.
- Repository-wide ESLint reports 53 errors and 6 warnings; its errors are outside
  the files changed for this feature.
- The existing Moderation/Application regression run reports 49 passing and 8 failing
  tests. Loading the original HEAD versions of the three shared components touched
  here reproduces the identical eight failures: six Moderation presentation assertions
  and two application drawer tests missing a QueryClient provider. They were not fixed
  or suppressed in this task.
- Browser QA used headless Chrome with contract fixtures at 1,440 × 1,000 and
  375 × 812, including light/dark themes and reduced motion. No runtime page errors
  occurred. Document widths stayed within their viewports; table overflow remained
  inside its container. The narrow drawer fit the available width. Nested Escape and
  focus return to both the photo opener and table View opener were verified.
- Diff review found no backend edits or unrelated formatting churn introduced by
  this task. Concurrent changes in other Business components/SpecialtyTagChip were
  preserved. No commit was created. Temporary visual/baseline harnesses were removed.

Relevant commands, from `sugbogo_frontend/web_app`:

```text
node --test src/features/admin-panel/all-reviews/tests/AllReviewsPage.test.js
node --test --test-concurrency=1 src/features/admin-panel/businesses/components/BusinessActions.test.js src/features/admin-panel/businesses/components/BusinessMetrics.test.js
node --test --test-concurrency=1 src/features/admin-panel/business-applications/components/review/RejectApplicationDrawer.test.js src/features/admin-panel/pages/ModerationIntegrityPage.test.js
node node_modules/eslint/bin/eslint.js .
node node_modules/vite/bin/vite.js build
```

## 12. Exact files changed by this task

```text
src/App.jsx
src/features/admin-panel/config/sidebarNavigation.js
src/features/admin-panel/components/data-table/DataTable.jsx
src/features/admin-panel/components/data-table/TableControls.jsx
src/shared/components/modals/Modal.jsx
src/features/admin-panel/pages/AllReviewsPage.jsx
src/features/admin-panel/all-reviews/services/allReviewService.js
src/features/admin-panel/all-reviews/queries/allReviewQueries.js
src/features/admin-panel/all-reviews/hooks/useAllReviewTableState.js
src/features/admin-panel/all-reviews/utils/allReviewTableState.js
src/features/admin-panel/all-reviews/utils/allReviewPresentation.js
src/features/admin-panel/all-reviews/utils/allReviewModeration.js
src/features/admin-panel/all-reviews/columns/allReviewColumns.jsx
src/features/admin-panel/all-reviews/components/AllReviewMetrics.jsx
src/features/admin-panel/all-reviews/components/AllReviewFilters.jsx
src/features/admin-panel/all-reviews/components/ReviewDate.jsx
src/features/admin-panel/all-reviews/components/ReviewStateBadge.jsx
src/features/admin-panel/all-reviews/components/AllReviewDrawer.jsx
src/features/admin-panel/all-reviews/components/AllReviewDetail.jsx
src/features/admin-panel/all-reviews/components/AllReviewReports.jsx
src/features/admin-panel/all-reviews/components/AllReviewHistory.jsx
src/features/admin-panel/all-reviews/tests/allReviewFixtures.js
src/features/admin-panel/all-reviews/tests/AllReviewsPage.test.js
docs/admin-all-reviews-frontend.md
```

## 13. Task 3 audit follow-up

No known All Reviews implementation blocker remains. Verify a live authenticated
Admin/Super Admin session against the deployed backend; browser QA here used contract
fixtures rather than a real user session. Keep the eight existing regression failures
and repository-wide lint debt visible during the audit. Existing bundle-size/Lottie
warnings are broader application concerns. No backend defect was discovered.
