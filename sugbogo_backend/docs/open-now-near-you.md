# Open Now Near You

The Explore homepage requests `GET /api/explorer/explore/open-now/` with required
finite `latitude` and `longitude` query parameters. Explorer and merchant accounts
can access the endpoint. It returns the standard success envelope containing an
array of existing Explorer business-card DTOs, with at most six entries. An empty
array is a successful result. This preview does not accept pagination or a custom
radius/limit.

## Eligibility and ordering

Only active businesses within 3 km of the supplied point qualify. Opening status
comes from stored weekly operating hours interpreted in `Asia/Manila`, including
24-hour schedules and overnight schedules belonging to the previous opening day.
Missing or incomplete hours do not establish that a business is open. Holiday or
temporary closures are not represented by this weekly schedule.

The full eligible set is ordered before the six-entry limit:

1. Geographic distance band: up to 1 km, over 1 km through 2 km, then over 2 km
   through 3 km.
2. Descending persisted Visibility Gap within each band.
3. Exact geographic distance, then business ID for stable ties.

Missing, provisional, or uncomputed Visibility Gap records receive a neutral
ranking value of `0.5`; their initialization value of `1` is not measured evidence.
Visibility Gap changes ordering only, never eligibility. Scores are read without
recomputation during this endpoint's request.

## Mobile behavior

Explore displays the existing carousel after Hidden Gems without a See all
action. Cards open the existing business profile and use the existing impression
tracking and save interactions. Successful empty results and unavailable initial
locations hide the section. Loading and request recovery remain separate states.

Pull-to-refresh waits for device location resolution before requesting this
preview with the returned coordinates. A failed location refresh retains the
last successful section location and displays an explanation. A failed business
refresh retains available results, removes the current Open now claim, and
offers Retry. Results from different coordinates are cached separately and are
not reused as placeholders for a new location.

The query refreshes when Explore regains focus, when the app returns to the
foreground, and every minute while Explore is active. Availability is based on
listed hours rather than live merchant confirmation. Distance is geographic,
not walking distance or travel time. These location-specific, time-sensitive
results are excluded from the homepage's persisted offline query allowlist.
