# Admin Management table standardization

## Inventory and architecture

The live Management navigation in `sidebarNavigation.js` defines the scope.
All live Management data tables already use `DataTable`, the same shell as All
Reviews. They also share `TableControls`, `TableHeader`, `TableBody`, skeletons,
empty/error states and `TablePagination`. Replacing feature tables or creating a
second table implementation would duplicate this existing architecture.

| Page or view inspected | Disposition |
| --- | --- |
| All Reviews | Replaced the native rows select with the shared flyout. Preserved review sorting, submission-date filters, metrics, drawer and backend pagination metadata. |
| Businesses | Enabled common sort/rows flyouts; removed the placeholder Export button and unused imports. Preserved list/map tabs and status actions. Table controls are suppressed in map view. |
| Merchant Applications | Enabled common sort/rows flyouts. Preserved queue/status/classification filters and review navigation. Existing local page and test changes were left intact. |
| Clusters & Categories: Clusters | Enabled common sort/rows flyouts; retained create/edit/delete actions. |
| Clusters & Categories: Categories | Same controls, preserving the existing cluster FilterMenu. |
| Clusters & Categories: Discovery Shortcuts | Same controls, preserving feature columns and management dialogs. |
| Specialty Tags | Enabled common sort/rows flyouts; retained create/edit/delete actions. Removed an existing unused useEffect import. |
| All Users | Enabled common sort/rows flyouts; retained role/status filters, permission-gated Add Admin and user actions. |
| Update Requests | Already uses the common shell; inherits toolbar wrapping, scrollbar, header and pagination refinements. No page logic changed. Retained its fixed page size and existing request/status filters; no unsupported sort/rows controls added. |
| Transit Network | Excluded: route, transit-point and transfer browsers use list/map/editor workspaces rather than data tables. Preserved their pagination and workflows. |
| Explorer Activity | Excluded: the current page renders a heading, with no data table. |
| Legacy MSMEs | Excluded: not mounted in App.jsx or current Management navigation; contains static sample rows and lacks the current controlled pagination contract. |
| Discovery Scores | Excluded: belongs to Insights; existing DataTable use inherits shared presentation/accessibility refinements, with no new feature controls or recompute changes. |
| Analytics, dashboard, Trust & Safety queues, detail/review workspaces | Excluded from redesign. Analytics exports and shared export utilities remain available. |

Existing hooks keep search, filtering, ordering, URL synchronization, fetching
and pagination within each feature. The new controls invoke those same handlers.
Sorting choices come exclusively from existing sortable table columns and their
existing identifiers; no API fields or sorting rules were introduced.

## Shared presentation

- Reused All Reviews' dark theme tokens, borders, surface backgrounds, rounded
  container, header typography, body density, badges and cell/action components.
  These were already shared and did not need a feature-by-feature rewrite.
- Added `RowsPerPageMenu`, a small wrapper over existing `SortMenu`. It preserves
  selected page sizes, includes the existing 10/25/50/100 choices, and uses the
  existing menu keyboard navigation, Escape dismissal and focus recovery.
- Added `TableViewControls` for existing controlled sort and pagination handlers.
  `config.managementControls` opts applicable pages in, defaulting to false so
  unrelated consumers do not receive additional controls.
- Search and filters stay on the left; the right group wraps and contains existing
  page actions followed by sorting and rows controls. Container padding reduces
  at narrow widths, and the search input cannot exceed its parent width.
- Kept horizontal table scrolling and made the existing themed scrollbar the
  fallback. Toolbar flyouts remain outside the table overflow container.
- Column sorting uses native focusable buttons with `aria-sort`; pagination and
  Clear Filters have explicit visible focus styles. Pagination targets are 36px.
- Loading, empty and error presentations continue through the same shared
  components, preserving feature-specific copy and retry handlers.

## Export removal

The only live Management Export button found was in Businesses. Its handler was
an empty callback, so there was no working export state or service to remove.
Removed the button, Download icon import and now-unused Button import. No backend,
export utility, analytics export, API, permission or navigation destination changed.

## Verification

- `npm run build`: passed. Existing large-bundle and lottie eval warnings remain.
- ESLint on all changed/new JS and JSX files: zero errors, one existing TanStack
  `react-hooks/incompatible-library` warning.
- `npm run lint`: failed with 51 errors and 6 warnings across the repository before
  cleaning two existing unused imports in touched files. Other existing errors
  include unused values, undefined names and React hook purity/effect rules.
- `node --test src/features/admin-panel/components/data-table/DataTable.test.js`:
  6/6 passed. Covers controlled search/filter/page/row callbacks, sort identifiers,
  page-size reset, menu keyboard navigation and focus, shared states, opt-in scope,
  Management Export absence and analytics export preservation.
- Serial Node test run for `BusinessApplicationsPage.test.js`,
  `BusinessActions.test.js` and `combineUpdateRequests.test.js`: 22/22 passed.
- All Reviews suite: 24/27 passed, including the updated flyout pagination test.
  Three failures reproduced using the original HEAD test/page/shared-table sources:
  stale "No reports" wording and two missing `business_id` expectations. These
  were preserved rather than changing unrelated behavior or hiding failures.
- Analytics workspace broad run found five failures. An isolated recheck of those
  five assertions produced one pass and four failures with both current and HEAD
  shared-table sources. Remaining failures concern cached refresh/retry states.
  The extra broad-run failure passed in both isolated rechecks.
- One concurrent management retry stalled after a Vite startup failure and was
  stopped; the subsequent serial management run passed all 22 tests.
- `git diff --check`: passed. No separate type-check or test script is configured
  in package.json; tests use the repository's existing Node/Vite/JSDOM convention.

## Remaining limits

Rendered viewport verification was not completed: control of the existing Chrome
window was denied, and an isolated in-app-browser preview timed out. Responsive
wrapping, scrolling and popover containment were reviewed in code; actual narrow
viewport appearance remains a manual verification item. DOM tests do not measure
layout or establish full assistive-technology compliance.

No backend files, dependencies, migrations, commits or pushes were introduced.
