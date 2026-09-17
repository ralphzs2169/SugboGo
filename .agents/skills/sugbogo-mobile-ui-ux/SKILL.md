---
name: sugbogo-mobile-ui-ux
description: Design, implement, or review SugboGo React Native mobile interfaces using the app's established visual, interaction, feedback, accessibility, and mobile-ergonomic conventions.
---

# SugboGo Mobile UI/UX

## Purpose and boundary

Keep mobile UI work visually consistent, usable, accessible, and aligned with the maintained SugboGo React Native application. Use the existing product language as the baseline, then make focused usability improvements without unrelated redesign.

This skill owns visual hierarchy, interaction behavior, feedback states, forms, touch behavior, navigation usability, accessibility, and mobile ergonomics. It does not own module organization, hooks, services, React Query architecture, API/data flow, or routing implementation. Inspect those conventions separately and mention them here only when they directly affect the user experience.

## Inspect before changing UI

- Read the repository and `sugbogo_frontend/mobile/AGENTS.md` instructions. Follow the mobile instruction to use the exact installed Expo version documentation before writing Expo-dependent code.
- Inspect the affected screen, its shared components, and at least one comparable maintained flow. Prefer repeated patterns, shared components, and newer implementations over isolated older code.
- Treat `src/features/explore`, merchant review/dispute flows, merchant registration, auth, and `YourInterestsScreen` as stronger current evidence than mock or incomplete screens.
- Do not generalize from `CommunityScreen`, `MapScreen`, `MyPocketsScreen`, `ReviewsSubmittedScreen`, or `VouchHistoryScreen` without corroboration. These contain mock data, incomplete actions, or older ad hoc UI patterns.
- If maintained implementations genuinely conflict, preserve the closest feature convention and state the ambiguity. Do not invent a repository-wide rule.

## Visual language

- Use NativeWind for component styling. Reuse semantic classes and scales from `tailwind.config.js`; use `src/constants/theme.ts` only for APIs that require raw color strings, such as icons, indicators, maps, and status bars.
- SugboGo orange (`brand`) is the primary action and active-state color. Use semantic success, error, info, text, background, surface, border, and disabled tokens instead of new per-screen colors.
- Use `AppText` and its Nunito Sans weights for new or substantially updated interface text. Establish hierarchy with weight, size, spacing, and concise copy before adding containers or borders.
- Prefer white/light neutral surfaces, restrained one-pixel borders, and the established rounded input, button, card, and pill shapes. Avoid excessive borders, stacked cards inside cards, and decoration without a hierarchy purpose.
- Use the existing icon families and shared icon mappings. Keep icon style and size consistent within a visual layer; do not use emoji as structural icons.
- Reuse official logo components/assets without recoloring or changing proportions. Use `Avatar` for user identity and `SpecialtyTagChip` for specialty display or selection instead of recreating either pattern.
- Selected states should combine a visible treatment such as fill/border, text or icon, and accessibility state. Do not communicate selection or status by color alone.
- Reuse `src/shared/styles/shadows.ts` for established surface elevation levels instead of repeating ad hoc shadow values. Use the shadow variant that matches the surface role, such as subtle cards, floating controls, elevated surfaces, or docked footers.
- Reuse `DottedTimelineConnector` for ordered journey/timeline relationships instead of recreating fixed dot counts or one-off connector lines. Let the surrounding layout control connector height so it adapts to dynamic content.

Canonical shared references include:

- `src/shared/components/AppText.tsx`
- `src/shared/components/Button.tsx`
- `src/shared/components/Avatar.tsx`
- `src/shared/components/SpecialtyTagChip.tsx`
- `src/shared/components/CustomTabBar.tsx`
- `src/shared/components/DottedTimelineConnector.tsx`
- `src/shared/components/MapMarker.tsx`
- `src/shared/components/MapMarkerCallout.tsx`
- `src/shared/styles/shadows.ts`

## Screen hierarchy and spacing

- Present a clear sequence: screen identity or title, concise supporting text when needed, primary content grouped into sections, then the main action and lower-emphasis alternatives.
- Use established screen gutters and the 4/8-based spacing rhythm. Make section gaps larger than gaps between related controls.
- Keep copy brief and actionable. Avoid repeated headings that restate the navigation title, dense explanatory paragraphs, and oversized introductions that push the task below the fold.
- Use section surfaces only when they clarify grouping. A simple list may use separators and spacing; not every row needs a decorated card.
- Keep the primary CTA visually dominant and reachable. Fixed action bars must reserve scroll inset and respect the bottom safe area; use `FixedFooter` or the closest feature footer pattern.

Good hierarchy references include `ExploreBusinessProfileScreen`, `MerchantReviewsScreen`, `ReviewDisputeDetailScreen`, and `YourInterestsScreen`.

## Touch and interaction

- Use `Pressable`, `SafePressable`, or the shared `Button` for new interactions. Provide immediate pressed feedback without moving layout bounds.
- Make tap areas practical: target at least 44pt on iOS and 48dp on Android where possible, or expand a smaller icon's hit area with padding or `hitSlop`. Do not rely on a tiny glyph as the target.
- Give disabled controls native disabled semantics and visibly lower emphasis. Pending actions must be disabled or guarded so repeated taps cannot duplicate work.
- Expose selected, disabled, expanded, and busy states through React Native accessibility state where applicable.
- Preserve standard back, scroll, pinch, and sheet gestures. Essential actions need a visible control and must not depend on an undiscoverable gesture.
- Confirm destructive or irreversible actions with `ConfirmModal`; explain the consequence, use destructive styling, and keep the modal open and actions disabled while the request is pending.

## Forms and keyboard UX

- Reuse `FormInput`, `PasswordInput`, `FormSelect`, `FormTextArea`, and their React Hook Form adapters. Keep visible labels; placeholders are examples or prompts, not replacements for labels.
- Show required state, helper text, and validation near the affected field. Clear stale field errors when the user meaningfully edits or focuses the field, while retaining unresolved form-level errors.
- Use appropriate `keyboardType`, capitalization, secure entry, multiline behavior, length limits, and character feedback. Authentication must allow paste and password managers.
- Put scrollable forms in a keyboard-safe layout. Follow `AuthLayout`, `RegistrationLayout`, and `CreateReviewDisputeScreen`: keep focused fields and submit actions visible, use `keyboardShouldPersistTaps="handled"`, and provide platform-appropriate keyboard dismissal.
- Submission buttons show a pending indicator, become non-interactive, and retain enough context for the user to understand what is happening.
- Protect meaningful dirty state on edit flows with a discard confirmation, as in `EditProfileScreen` and `YourInterestsScreen`. Keep Save disabled when nothing changed where the flow supports reliable dirty tracking.
- Use the merchant registration stepper, validation-before-advance, persistent footer, draft recovery, and review/edit loop only for genuinely multi-step flows; do not impose wizard chrome on ordinary forms.

## Loading, errors, empty states, and feedback

### Loading

- Prefer a skeleton that matches known content structure for initial screen or section loading. Reuse `Skeleton` and nearby feature skeletons; it is intentionally static because animated pulsing was removed for transition performance.
- Keep the stable screen shell mounted when practical and replace only unresolved content, as `ExploreBusinessProfileScreen` does.
- When one section refetches, preserve the rest of the page and show a section skeleton or small pending state. Do not replace the whole screen unnecessarily.
- Use pull-to-refresh for user-initiated refresh on established scroll/list screens. Keep pull-to-refresh separate from infinite-pagination loading; `RefreshControl` should not show its refreshing state while a next page is being fetched.

- For `FlatList` screens backed by `useInfiniteQuery`, use the shared looping Lottie loading animation in `ListFooterComponent` while `isFetchingNextPage` is true. Follow `ExploreCollectionScreen`: use the existing `loading.json` animation at approximately `50x50`, centered with vertical padding. Do not use the initial skeleton, `ActivityIndicator`, or a different pagination animation for the same next-page state unless the feature has a specific established exception.

- When pagination is exhausted, replace the next-page loader with `EndOfListMessage` where completion feedback is useful. Never show the pagination loader and completion message at the same time.

- Use the shared `Button` loading state for mutations rather than the list pagination loader.
- Reserve `LoadingScreen` for blocking operations or flows without meaningful content structure, not as the default for every query.

### Errors

- Keep request/system errors distinct from valid empty results. Use the shared `ErrorState` for persistent page or section recovery; mascot empty states must not represent failed requests.
- For React Query screens, let the query hook expose its error. When the surrounding feature has adopted `useApiErrorNotification()`, use it for the one-time notification; otherwise preserve the maintained feature's existing system-error/toast path. A toast may accompany but must not replace a persistent error state when content failed to load.
- Retry only the failed query through its `refetch()`. Preserve unaffected content and cached content where possible; do not reload the app or entire page for one failed section.
- Use page-level recovery when no usable screen context exists and `size="section"` for localized failures. Offer Back only when it is a meaningful escape route.

Canonical references: `ErrorState`, `SearchFilterEmptyState`, `ExploreCollectionEmptyState`, `MerchantReviewsScreen`, and `BusinessReviewsSection`.

### Empty and completion states

- Explain what is absent and, when useful, what the user can do next. Keep the tone lightweight rather than alarming.
- Distinguish true empty, filtered/search no-results, and completed/all-caught-up states. `MerchantReviewsScreen` and `ReviewDisputesScreen` use different mascot/copy combinations for these meanings.
- Use existing WebP mascot assets for prominent, meaningful empty states when a matching asset exists. Compact section empties may use a restrained icon and text, as `ExploreSectionEmptyState` does; a mascot is not mandatory everywhere.
- Use `EndOfListMessage` for quiet pagination completion rather than a full empty illustration.

### Status and transient feedback

- Status badges must pair semantic color with text and, where established, an icon. Follow `ReviewDisputeStatusBadge` for moderation status; do not rely on color alone.
- Use inline state for information the user must retain, and toast feedback for brief success or non-blocking failure confirmation. Pending application, dispute, review, and moderation states should say what is happening or what happens next.

## Lists, cards, and media

- Use `FlatList` for growing or long collections and tune stable keys, separators, empty/footer states, and pagination. Use `ScrollView` for bounded content or established small horizontal carousels.
- Infinite `FlatList` pagination should follow the maintained Explore collection pattern: guard duplicate `onEndReached` calls, fetch only when another page exists and no next-page request is active, use the shared Lottie animation in `ListFooterComponent` during `isFetchingNextPage`, and show `EndOfListMessage` only after pagination is exhausted.
- Keep list rows scannable: identity/title first, supporting metadata second, status/action last. Truncate secondary text deliberately and avoid displaying every available field.
- Choose separators for simple homogeneous rows and cards when the item is a distinct interactive object with grouped media/metadata. Follow `BusinessCard`, `MerchantReviewCard`, and dispute list items for their respective densities.
- Use `expo-image` for new content images. Give images explicit dimensions or aspect ratios, choose `contentFit="cover"` for thumbnails/heroes and `contain` for logos, mascots, documents, or fullscreen viewing, and provide a neutral or semantic fallback.
- Keep avatars circular and use `Avatar`; keep card and hero images clipped to their container radius. Use `FullScreenPhotoViewer` for established multi-photo viewing behavior.
- Prefer the existing WebP/PNG mascot and onboarding assets for raster illustration performance. Keep existing SVGs for logos and purpose-built vector icons/illustrations; do not add a media library or convert formats without evidence of a real problem.
- Avoid rendering source-resolution images when a bounded display size is sufficient. Preserve the existing image processing/upload constraints in the affected flow.

## Sheets, dialogs, and screens

- Use `SelectionBottomSheet` for a small contextual choice and `ActionBottomSheet` for a short action menu. Use a dedicated feature sheet for richer but still contextual composition, such as review replies.
- Use `ConfirmModal` for brief confirmation, especially destructive or discard actions.
- Use a dedicated screen for multi-step, map-first, information-heavy, or independently navigable work, such as registration, location picking, dispute creation, and dispute details.
- Sheets must have a clear title when context is not obvious, safe-area padding, backdrop dismissal or an explicit Close/Cancel route, Android back behavior where needed, and keyboard-aware inputs. Avoid opening a modal over another modal or sheet.

## Navigation and app modes

- Preserve predictable Back behavior and the user's prior context. Push detail/edit screens; replace only when completing a mode switch, onboarding, authentication, or another flow that should not remain in history.
- Do not show duplicate headers or back affordances. Respect the header ownership of the nearest Expo Router layout.
- Tab screens use `CustomTabBar` and must leave content above it with `useTabBarSpacing()` or an equivalent safe-area-aware inset. Fixed controls must not overlap the tab bar or gesture area.
- Explorer is discovery/community/profile activity; Merchant is business management, reviews, disputes, analytics, and business profile management. Keep Merchant management actions out of Explorer tabs. Switching mode is an explicit profile action that replaces the active tab context; it does not merge both navigation systems.
- Prefer a bottom sheet over navigation only for brief contextual work. Preserve a dedicated route when users need history, deep context, or substantial input.

## Maps and location

- Treat merchant registration's `LocationPickerScreen`, `LocationPickerMap`, and `LandmarkPickerScreen` as the stronger current map-selection references. The Explorer `MapScreen` is still mock/incomplete and does not establish finished product behavior.
- Keep maps visually primary in location selection. Overlay search, instructions, and confirmation without covering the selected marker or critical controls; use safe-area and tab-bar offsets.
- Reuse `MapMarker` and `MapMarkerCallout` for maintained map flows instead of falling back to native map pins/callouts when the shared SugboGo marker language applies. Keep marker variants semantically meaningful: user identity, selected origin, boarding, alighting, and business destination should remain visually distinguishable.
- Hold selection locally until explicit confirmation. Show a clear marker and resolved-address/service-area state, reject invalid locations with text plus visual status, and prevent taps during confirmation or overlapping suggestion interaction.
- Keep the selected coordinates, marker, address, preview, and map camera synchronized. Guard against stale reverse-geocode responses and accidental map taps during programmatic movement.
- Do not invent routes, live discovery behavior, directions, or location-changing gestures that the product has not implemented.

## Accessibility safeguards

Repository usage is improving but not uniform. Apply these standard React Native safeguards while preserving the visual language:

- Maintain readable contrast: normally at least 4.5:1 for text and 3:1 for meaningful non-text controls/status indicators.
- Give icon-only controls an `accessibilityLabel` and correct role; hide decorative icons beside equivalent visible text from the accessibility tree.
- Keep screen-reader order aligned with visual order and announce applicable selected, disabled, expanded, and busy state.
- Do not use color as the only meaning. Pair status and validation color with text, icon, border, or state semantics.
- Allow Dynamic Type/text scaling without clipping essential copy or controls. Verify key flows at a large system text size and with reduced motion.
- Do not let sticky UI, sheets, or the keyboard obscure the focused control. Provide visible alternatives for drag, swipe, pinch, or map-only actions when the action is essential.

## Documentation, performance, and scope

- Add concise component-level documentation to complete React/React Native components, describing purpose and important behavior. Do not document props or parameters in that component-level documentation.
- Add concise structural comments before major JSX sections. Avoid comments that merely narrate an obvious element or repeat its label.
- Keep visual components focused on presentation and interaction; do not fetch APIs directly inside reusable visual components. Leave detailed data-flow decisions to frontend architecture conventions.
- Avoid unnecessary rerenders and per-frame work in large lists or maps. Preserve stable handlers/configuration where viewability, impressions, clustering, or animated scroll state depends on them.
- Reuse established components before abstracting. Do not create a generic component for a single one-off visual, add a dependency for existing capability, or introduce custom animation without a clear interaction purpose.
- Make the smallest UI change that solves the request. Do not redesign an entire screen, create a new design system, or change the visual language merely to look more modern.
- Keep automated UI tests focused on user-visible behavior and meaningful interaction states. Do not let tests unnecessarily lock styling, layout measurements, decorative details, or incidental copy that may change during normal UI polish. Detailed frontend testing conventions belong to the mobile frontend architecture skill.

## Completion checklist

- [ ] Inspected the nearest maintained screen and reused theme tokens/shared components.
- [ ] Kept Explorer and Merchant responsibilities distinct and avoided unrelated redesign.
- [ ] Made title, supporting content, sections, and primary action easy to scan.
- [ ] Added an appropriate initial/section/button loading state.
- [ ] Kept valid empty state distinct from request error; added persistent Retry calling the failed query's `refetch()` where applicable.
- [ ] Prevented duplicate async actions and made disabled/pending state clear.
- [ ] Verified practical touch targets, pressed feedback, icon-only labels, and non-color status meaning.
- [ ] Verified keyboard, dirty-state, safe-area, fixed-footer, and tab-bar behavior where relevant.
- [ ] Used `expo-image`, explicit sizing/fit, and appropriate fallbacks for new media.
- [ ] Preserved component documentation and concise major-section JSX comments.
- [ ] Added no unnecessary dependency, abstraction, animation, or screen-wide redesign.
- [ ] Ran focused lint, type, behavior-oriented tests, or build validation appropriate to the changed UI without unnecessarily testing visual polish.
- [ ] For infinite `FlatList` pagination, used the shared Lottie footer loader for `isFetchingNextPage`, kept it separate from pull-to-refresh, and used `EndOfListMessage` when the collection is exhausted.
