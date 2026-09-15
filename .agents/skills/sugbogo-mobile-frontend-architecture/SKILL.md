---
name: sugbogo-mobile-frontend-architecture
description: Apply the established SugboGo Expo React Native architecture when implementing, reviewing, or refactoring mobile frontend work.
metadata:
  short-description: SugboGo mobile frontend architecture
---

# SugboGo Mobile Frontend Architecture

Use this skill for work in the SugboGo mobile frontend.

Preserve the existing architecture and visual language. Inspect nearby implementations before introducing new abstractions. Prefer current established patterns over older or isolated implementations.

The current architectural direction is:

- Expo Router route files as thin navigation boundaries.
- Feature-owned screens, components, hooks, services, types, utilities, constants, and validation.
- TanStack React Query for new server-backed state.
- `useInfiniteQuery` for growing backend-paginated collections.
- Zustand only for genuine cross-route client state that is not authoritative server state.
- NativeWind using the existing SugboGo design tokens.
- Shared components for common buttons, typography, errors, skeletons, list states, forms, bottom sheets, and other reusable UI.
- Explicit separation between initial loading, pull-to-refresh, next-page loading, errors, empty states, and completed collections.

Some older areas still use manual request state, direct React Native `Text`, mock data, one-off controls, or older loading patterns. Preserve them when necessary, but do not copy them into new work unless the surrounding feature intentionally requires it.

## 1. Folder and module architecture

Organize business behavior by feature under `src/features`.

Typical feature structure:

```text
feature/
  api/
  components/
  hooks/
  screens/
  types/
  utils/
  constants/
  validation/
  stores/
```

Use feature-local subfolders for substantial workflows, for example:

```text
features/explore/components/business-profile
features/explore/components/search-filter-results
features/merchant/components/registration
features/merchant/components/review-disputes
features/profile/components/your-interests
```

Place genuinely reusable cross-feature code under `src/shared`.

Common shared areas include:

```text
src/shared/components
src/shared/api
src/shared/hooks
src/shared/types
src/shared/constants
src/shared/utils
```

Use feature ownership for new screens, API integrations, query hooks, domain types, domain-specific utilities, and domain-specific components.

Use `shared` only when code is reused across features or represents application infrastructure.

Do not create a generic abstraction merely because two unrelated screens contain similar JSX once.

## 2. Routing and screen boundaries

Expo Router files under `src/app` should normally remain thin.

Route files may:

- render a feature screen;
- read and validate route parameters;
- convert route strings into typed values;
- define stack, tab, presentation, or animation options;
- contain route-specific lifecycle behavior when the behavior truly belongs to navigation.

Feature UI, data coordination, business presentation, and reusable interaction logic belong under `src/features/**`.

Representative route groups include:

```text
(auth)
(explorer)
(merchant)
(setup)
```

Use layout files for navigation boundaries, guards, tabs, and route-group configuration.

For new navigable screens, prefer this shape:

```tsx
import ExampleScreen from "@/features/example/screens/ExampleScreen";

/**
 * Route entry for the example screen.
 */
export default function ExampleRoute() {
  return <ExampleScreen />;
}
```

Specialized picker routes, success routes, or routes with route-specific dismissal/focus behavior may contain additional navigation logic. Do not move route-specific behavior into unrelated feature components just to make every route file identical.

## 3. Server state and React Query

Use TanStack React Query for new server-backed state.

Use:

- `useQuery` for ordinary reads;
- `useInfiniteQuery` for growing paginated collections;
- `useMutation` for writes;
- `useQueryClient` for invalidation and cache updates.

Query hooks should call feature API services and convert the project API envelope using the existing `throwOnApiError` helper.

Screens should receive UI-friendly values from hooks rather than raw API envelopes.

Typical hook outputs include:

```text
data/items
totalCount
isLoading or isInitialLoading
isFetching
isRefetching
isFetchingNextPage
hasNextPage
fetchNextPage
error
refetch
```

Use React state for local UI state such as:

```text
draft filters
selected tabs
modal visibility
temporary form values
selected IDs
local composition state
```

Use Zustand only for genuine cross-route client state that is not authoritative server state, such as:

```text
authentication
active app mode
temporary multi-route workflow state
```

Do not move server data into Zustand merely to avoid creating a React Query key.

Older manual hooks may remain when modifying an existing workflow. Do not refactor unrelated legacy server-state code solely for consistency.

## 4. API service conventions

Keep HTTP calls in feature API services.

Services should:

- use the established API client;
- use the established request wrapper;
- return typed `ApiResponse<T>`;
- keep endpoint paths and payload construction out of screens and ordinary components;
- keep multipart construction and domain-specific request helpers close to the feature API layer.

Shared networking infrastructure belongs under `src/shared/api`.

Screens and presentation components should not call Axios directly.

## 5. Query keys and mutation invalidation

Give every query a stable prefix.

Prefer exported key constants and key factories when a query depends on entity IDs, filters, or criteria.

Example:

```ts
export const EXAMPLE_QUERY_KEY = ["example"] as const;

export function exampleQueryKey(id: number, filter: string) {
  return [...EXAMPLE_QUERY_KEY, id, filter] as const;
}
```

Normalize values before including them in keys when ordering should not create separate caches.

For paginated filtered lists, include applied server-side filter values in the query key.

Example:

```ts
["business-reviews", businessId, filter]
```

Keep a stable base prefix so mutations can invalidate all relevant variants.

After successful mutations:

- invalidate every affected authoritative query;
- use `Promise.all` when multiple related queries must refresh;
- use `setQueryData` only when an immediate cache update meaningfully improves the interaction;
- cancel relevant queries before optimistic updates;
- restore previous cache data on optimistic failure;
- invalidate authoritative server data after settlement when appropriate.

Do not create unrelated key names for the same resource.

Do not invalidate only the currently visible query when a mutation also affects detail, preview, list, collection, recommendation, or filtered variants.

A centralized key factory is preferred when one already exists, but do not create unnecessary indirection for a trivial one-off key.

## 6. Paginated list conventions

Use `useInfiniteQuery` for backend-paginated collections that are expected to grow and are presented as scrollable lists.

The standard pattern is:

```text
initialPageParam = 1
queryFn receives pageParam
service sends page to backend
getNextPageParam reads backend pagination
return undefined when has_next is false
hook flattens pages
screen renders flattened items
```

Preserve backend ordering.

For backend-ranked or backend-filtered collections, do not client-sort or client-filter only the pages that happen to be loaded.

If a paginated screen has filters:

- keep applied filters on the server;
- include applied filters in the React Query key;
- let the backend own ranking, filtering, and pagination;
- keep draft filter state local to the filter UI until Apply is pressed.

### FlatList loading states

Growing `FlatList` screens must distinguish all loading phases.

Initial load:

```text
feature-specific skeleton or screen skeleton
```

Pull-to-refresh:

```text
RefreshControl using isRefetching
```

Next-page load:

```text
ListFooterComponent with the existing shared looping Lottie loading animation
```

Completed collection:

```text
EndOfListMessage
```

Do not reuse the full-screen skeleton while loading another page.

Do not show the pull-to-refresh spinner for next-page loading.

Do not show the end-of-list message while a next page is still loading.

The current next-page footer convention is:

```tsx
ListFooterComponent={
  isFetchingNextPage ? (
    <View className="items-center py-5" testID="collection-page-loader">
      <LottieView
        source={loadingAnimation}
        autoPlay
        loop
        style={{ width: 50, height: 50 }}
      />
    </View>
  ) : shouldShowEndMessage ? (
    <EndOfListMessage />
  ) : null
}
```

Reuse the existing shared loading Lottie asset already used by collection screens rather than creating a new pagination spinner.

Use `onEndReachedThreshold={0.35}` as the normal project default unless the feature has a specific reason to differ.

Guard duplicate next-page requests. A list should not call `fetchNextPage()` when:

```text
there is no next page
a next page is already being fetched
the same onEndReached event has already been handled for the current momentum/scroll cycle
```

Keep `ListEmptyComponent` for true empty states.

Keep `ListFooterComponent` for next-page loading and end-of-list messaging.

Do not put pagination loaders in `ListHeaderComponent`.

Business review previews and other deliberately bounded detail previews may remain non-paginated.

## 7. Screen data ownership and request errors

Data-fetching hooks own request state and expose it to the screen.

The screen owns presentation decisions such as:

```text
full-screen skeletons
section skeletons
persistent retry states
pull-to-refresh
navigation
filter UI
opening sheets and modals
```

For page-level data fetching:

- expose `error` and `refetch` from the data hook;
- use `useApiErrorNotification()` in the page to show the user-facing toast;
- show a persistent `ErrorState` in the affected UI section;
- Retry must call that request's `refetch()`;
- do not reload the entire application because one request failed.

Use `ErrorState` with `size="section"` for localized failures when appropriate.

Use the existing shared API error helpers for system and field errors.

Do not replace a retryable persistent error state with a toast only when the affected content cannot render.

## 8. Loading, empty, and completed states

Keep these states semantically distinct:

### Initial loading

Use a feature-specific skeleton when the structure is known.

Use a broader loading screen only when the entire screen is genuinely blocked and a skeleton is not appropriate.

### Background refresh

Use `RefreshControl` for user-initiated pull-to-refresh.

### Next-page loading

Use the shared looping Lottie animation in `ListFooterComponent`.

### Error

Use `ErrorState` with Retry.

### Empty result

Use a feature-specific empty state.

Mascots are appropriate for neutral, positive, or meaningful product empty states.

Do not use mascot empty states for request failures.

### Completed collection

Use `EndOfListMessage` when the list is exhausted and the screen has enough content for the message to be useful.

## 9. Forms and validation

Use React Hook Form and Zod for complex, multi-step, or nested forms.

Typical complex-form patterns include:

```text
FormProvider
useFormContext
shared RHF field wrappers
feature-local Zod schemas
step-specific trigger(...) validation
payload builders
server-draft mappers and normalizers
unsaved-change comparison utilities
```

For small forms, follow the nearest established feature pattern.

Do not introduce React Hook Form for a tiny form solely for architectural uniformity if local state is clearer.

Keep field validation errors close to their fields.

Use the existing structured backend field-error helpers.

Keep field-level validation errors separate from system-level request failures.

Clear stale field errors when the project pattern already does so on focus or change.

## 10. Bottom sheets and modals

Use the root bottom-sheet provider already configured by the app.

Use `BottomSheetModal` for selections, action menus, filters, and composer workflows.

Use the existing helper for presenting sheets when keyboard dismissal and deferred presentation are needed.

Use shared sheets for genuinely reusable selection/action behavior.

Use feature-owned sheets for domain-specific content.

### Bottom-sheet safe area

Bottom-sheet content that reaches the device bottom edge should account for the bottom safe-area inset.

Preferred pattern:

```tsx
const insets = useSafeAreaInsets();

<BottomSheetView
  style={{
    paddingBottom: Math.max(insets.bottom, 32),
  }}
>
  ...
</BottomSheetView>
```

Keep horizontal spacing in NativeWind classes when appropriate.

Do not wrap ordinary bottom-sheet content in an additional `SafeAreaView` merely to get bottom spacing.

Use `BottomSheetScrollView` for scrollable sheet content.

Use `BottomSheetTextInput` for text entry inside bottom sheets when appropriate.

## 11. Keyboard and safe-area handling

Keyboard handling is workflow-specific and must preserve both usability and layout quality.

The required behavior is:

```text
keyboard closed:
the intended composition remains visually correct

keyboard open:
the focused input stays visible
the screen moves only as much as necessary
content remains scrollable when needed
```

Reuse the shared layout already established for the workflow instead of independently adding keyboard containers to individual screens.

Do not nest competing keyboard-management systems.

Before changing keyboard behavior, inspect the current shared layout and preserve its visual composition.

Do not promote a new keyboard strategy to a project-wide rule until it is proven to work across the affected screens.

For safe areas:

- use the root `SafeAreaProvider`;
- use `SafeAreaView` or `useSafeAreaInsets()` where the screen structure requires it;
- fixed bottom actions must respect the device bottom inset;
- bottom sheets should normally use bottom inset padding rather than a nested `SafeAreaView`;
- avoid hardcoded device-specific offsets.

## 12. Shared component reuse

Prefer existing shared components before creating feature-local duplicates.

Important reusable building blocks include:

```text
Button
AppText
ErrorState
Skeleton
EndOfListMessage
LoadingScreen
FixedFooter
SafePressable
Avatar
FormInput
FormSelect
FormTextArea
ConfirmModal
SelectionBottomSheet
ActionBottomSheet
```

Use the shared `Button` for standard actions when it already supports the required behavior.

Use `ErrorState` for retryable failures instead of recreating error layouts.

Use `AppText` for new production UI unless the neighboring implementation has a deliberate reason to use raw React Native `Text`.

Use `SafePressable` for navigation-sensitive interactions where preventing presses after focus/navigation loss is useful.

Do not make `SafePressable` mandatory for every pressable surface.

Keep feature-specific components when they encode domain behavior or presentation.

## 13. Styling and accessibility

Use NativeWind for ordinary component styling.

Reuse the existing tokens from the project theme and Tailwind configuration.

Use imperative theme color values only where an API requires raw color strings, such as:

```text
icons
activity indicators
maps
status bars
native component props
```

Do not use the theme object as a second layout/styling system when NativeWind classes are sufficient.

Do not introduce a new color, font, spacing, or radius system without an explicit design change.

### Clickable UI

Clickable React and React Native UI must include pointer-cursor styling where applicable.

For NativeWind clickable surfaces, prefer:

```text
cursor-pointer
```

alongside the existing pressed/active visual behavior.

Interactive controls should provide appropriate accessibility metadata, including when relevant:

```text
accessibilityRole
accessibilityLabel
accessibilityState
accessibilityHint
```

Selected, checked, disabled, and expanded states should be exposed where appropriate.

## 14. Component documentation and JSX comments

When generating a complete React or React Native component, add concise component-level documentation describing:

- the component's purpose;
- important behavior that is not obvious from its name.

Do not document props or parameters in the component-level documentation.

Example:

```tsx
/**
 * Displays the user's selectable built-in avatars in a bottom sheet.
 *
 * Selecting an avatar immediately closes the sheet and returns the chosen key.
 */
export default function AvatarPickerBottomSheet(...) {
```

In returned JSX, add concise comments that distinguish major UI sections.

Good examples:

```tsx
{/* Header */}
{/* Filters */}
{/* Review list */}
{/* Pagination footer */}
{/* Bottom actions */}
```

Do not add comments that merely restate obvious implementation details.

## 15. Frontend testing

Test behavior, not appearance.

Automated frontend tests should protect meaningful application behavior without unnecessarily locking the UI to its current visual design or wording.

Prioritize tests for:

- user interactions and state transitions;
- expand/collapse and selection behavior;
- navigation behavior;
- mutations and action handlers;
- form validation;
- loading, error, empty, and completed states;
- conditional rendering based on backend data;
- permissions and access-dependent behavior;
- filtering and other behavior that changes results.

Do not test presentation details that may change during normal UI polish, including:

- width and height;
- spacing and padding;
- colors;
- typography;
- border radius;
- layout measurements;
- decorative styling.

Avoid asserting exact UI copy when the wording itself is not part of the behavior being protected.

Simple presentational components do not require dedicated tests unless they contain meaningful logic or conditional behavior.

Prefer a small number of behavior-focused tests over exhaustive rendering assertions.

For example, a journey card with expand/collapse behavior and optional landmark guidance should test those behaviors. It does not need tests asserting exact dimensions, spacing, or every rendered sentence.

## 16. Type placement, constants, and utilities

Place domain types beside their feature.

Place cross-feature types under `src/shared/types`.

Place constants in the narrowest appropriate scope.

Use:

```text
feature constants for feature behavior
shared constants for cross-feature values
theme constants for imperative UI colors
shared layout constants for global measurements
```

Use `as const` for query-key prefixes and fixed option collections when type narrowing is useful.

Keep mapping, normalization, comparison, and payload-building logic in named utilities when the transformation is substantial.

Do not bury large data transformations inside screens.

## 17. New code versus legacy code

When implementing new functionality, use the current preferred architecture.

Do not refactor unrelated legacy hooks, screens, routes, or API calls solely to make the repository stylistically uniform.

When modifying an older feature:

- preserve its existing behavior;
- improve architecture only where the requested change naturally touches it;
- avoid expanding the task into a broad migration unless explicitly requested.

Older manual request hooks, mock screens, direct `Text`, and prototype interaction patterns are not architectural defaults for new code.

## 18. Legacy patterns that should not be copied

Do not use older manual `useEffect` + request-state hooks as the default for new server-backed features when React Query is appropriate.

Do not use local mock arrays as examples of production API architecture.

Do not copy prototype community/map interaction patterns into server-backed production features without first checking current architecture.

Do not revive commented-out stores or abandoned state-management approaches.

Do not create direct Axios calls inside ordinary screens.

Do not implement growing backend collections with client-only filtering over currently loaded pages.

Do not show the same loader for initial load, refresh, and next-page fetches.

Do not reload an entire screen/application to recover from one failed API section.

## 19. Preferred implementation checklist

Before completing new mobile frontend work, verify:

- the route file is thin unless route-specific logic is required;
- feature behavior lives under the correct feature module;
- new server state uses React Query;
- growing paginated collections use `useInfiniteQuery`;
- server-side filters are included in the query key;
- mutation invalidation reaches every affected cached surface;
- initial loading uses a skeleton where appropriate;
- pull-to-refresh uses `RefreshControl`;
- next-page loading uses the shared Lottie animation in `ListFooterComponent`;
- exhausted paginated lists use `EndOfListMessage` where useful;
- duplicate `onEndReached` calls are guarded;
- page-level request errors expose Retry through `refetch()`;
- pages use `useApiErrorNotification()` for user-facing API failure toasts;
- shared UI primitives are reused before creating duplicates;
- bottom sheets account for the device bottom inset;
- clickable UI includes `cursor-pointer` where applicable;
- interactive controls include appropriate accessibility metadata;
- complete components include concise component-level documentation;
- returned JSX contains comments for major structural sections only;
- unrelated legacy code was not refactored merely for consistency.
