# Simpler route authoring

This follow-up preserves the existing SugboGo layout, components, API fields and save behavior. It removes the duplicate Add Route action at the bottom of the route browser; the top action opens the form and Create Route saves it.

Visible wording now uses Direction, Starting stop, Last stop, Stops in travel order and Route path. The point form explains that its name is the landmark/stop label passengers recognize, and that its marker belongs at the actual roadside boarding or drop-off spot. Coordinates still come from the map and remain read-only. Internal variant IDs and payload field names are unchanged.

For a route with no directions, the inspector offers Add First Direction and explains why a code alone cannot provide guidance. The direction editor separates Choose stops and Draw the route path, and explains that drawing points are not boarding stops. Return journeys still need their own directions; no automatic reverse path is generated. Three garbled map-label separators found during browser review were also restored.

## How to check

1. Refresh Transit Network. Confirm there is one Add Route entry action in Routes browse mode.
2. Select 06B. Expect Add First Direction and the explanation for missing directions.
3. Open that form. Confirm Starting stop, Last stop, Choose stops, Draw the route path and Save Direction are clear.
4. Search for a stop; Create new stop should open the existing map placement form, retaining the direction draft. Confirm Stop or landmark name and roadside placement guidance are visible.
5. Cancel the point form and direction editor. Do not save guessed 06B geometry or modify DEV fixtures during this wording check.

## Migration and limits

No database migrations, environment changes or backend/mobile changes. The development server updates these UI files through HMR; refresh if it is disconnected. Production requires a new web build/deployment.

This is a presentation refinement, not spatial validation, a new authoring wizard or a reviewed route seed. Existing backend validation messages may still use internal Transit Point terminology. Shared geometry validation, source review, larger-network pagination and actual 06B alignment remain separate work.

## Recorded results

- Scoped lint for the changed editor components passed.
- Production build passed with the existing bundle-size/lottie warnings.
- Browser checks passed against the isolated transit backend: one Add Route entry action; 06B shows Add First Direction; the editor shows the simplified labels; Create new stop opens the naming/placement guidance; cancel returns to the direction draft and then browse mode. No records were created or modified. Live base tiles and managed markers also loaded. No new tests were added for these copy and duplicate-action changes.
- User confirmed acceptance and authorized the local UI commit after reviewing the changes. Final web build passed in 2.42 seconds; final scoped lint and whitespace checks passed.
- The earlier map fix is local commit `b533ab20`; this UI follow-up is committed separately. Neither was pushed. Existing uncommitted seed and unrelated files remain excluded.
