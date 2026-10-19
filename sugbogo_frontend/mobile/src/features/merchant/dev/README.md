# Analytics development previews

In a development build, open Merchant Analytics and tap **Open Analytics development preview** above Detailed reports.

The gallery covers Business overview, current specialty support, unanswered reviews, visibility, route planning, report navigation, visit sources, Pocket trends, Review performance, visit timing, and Review insights. Existing Peer comparisons, Recommendations, and Specialty trends previews are linked below the selected preview.

Choose a section, then an applicable state. Preview period and interval controls change local fixtures only. Retry restores populated data. Review-navigation actions show a destination message instead of opening real reviews. Information sheets use the real components.

All data is synthetic and uses a fixed reporting reference time. No report hooks are mounted in the gallery, and no API requests, MongoDB/PostgreSQL writes, AI generation, or entitlement changes are performed. Production builds redirect the preview route to Analytics, and the main-screen entry is guarded by `__DEV__`.

These fixtures test presentation manually; they do not establish tracking coverage or replace live API/device verification. Partial visibility reports remain marked unverified. Historical review insights retain their own dates. Current specialty support and unanswered-review snapshots do not change with the reporting period.

Manual QA: narrow Android widths, large font settings, graph scrolling, chart toggles, exact values, information sheets and hardware back, period selection, Retry, and each existing dedicated preview.
