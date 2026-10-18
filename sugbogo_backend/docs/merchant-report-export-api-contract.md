# Merchant report PDF export: API and frontend handoff

Branch: `feat/merchant-analytics-report-export`.
Base: inspected main `99faf38b`, 16 October 2026 (Asia/Manila).

## First-release scope

Download the existing Premium merchant report as a PDF. Reuse `MerchantReportService` for all calculations and `MerchantReportSerializer` for the sanitized output allowlist. Each export calculates once with one resolved reporting clock, serializes once, then renders that report. No metric calculation, ownership policy, entitlement rule or existing JSON response is replaced.

Included sections: Standard analytics; Premium visibility, Pocket, retained specialty trends, stored review insights and review performance; anonymous peer comparisons; changes and their limitations; deterministic findings/actions; report/source metadata.

The current composed report does not contain the engagement heatmap or stored AI recommendations; they remain excluded as approved. Existing stored review insights retain their safe content gate and original coverage. Reading a report does not generate AI content or queue refresh work.

This release introduces no saved-report model, server file storage, public download URL, report-history API, new Django app, scheduler or background generation. Re-exporting the same dates creates a fresh report as of that request's reporting clock; it does not retrieve an immutable server snapshot or guarantee identity with an earlier screen request.

## Endpoint and query

`GET /api/merchant/analytics/premium/report/export/`

The endpoint reuses the existing Premium permission chain: authentication, active merchant role, server-side Plus access, then server-derived owned business. Preview/mock entitlement modes retain their existing behavior. Request parameters cannot grant access or select another merchant's business.

| Parameter | Values | Default |
| --- | --- | --- |
| `period` | `7`, `30`, `90`, `custom` | `30` |
| `start_date`, `end_date` | ISO `YYYY-MM-DD`, required together for custom | Omitted for presets |
| `interval` | `daily`, `weekly`, for the report's visibility series | `daily` |

Dates use the existing Manila reporting resolver and UTC half-open `[start, end)` bounds. Custom dates must be ordered and not future. Exports support at most 366 inclusive calendar days; the existing JSON report endpoint retains its own unchanged validation. Unknown and repeated parameters are rejected. There is no client-selected format, prompt, policy, business/user ID or entitlement flag.

Examples:

```text
/api/merchant/analytics/premium/report/export/?period=30
/api/merchant/analytics/premium/report/export/?period=90&interval=weekly
/api/merchant/analytics/premium/report/export/?period=custom&start_date=2026-10-01&end_date=2026-10-12&interval=daily
```

## Binary success and JSON errors

Success is HTTP 200 with a **binary PDF body**, not the usual `success/message/data` JSON envelope:

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="sugbogo-merchant-report-<owned-business-id>-<start-date>-<end-date>.pdf"
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
```

The filename uses only server-derived business ID and validated dates, never business/user text. PDF and JSON Accept headers are supported. Standard authentication, validation and other handled API errors remain JSON, including when the client requests `Accept: application/pdf`.

- 400: invalid/unsupported query, overlong period, or report exceeding rendering limits.
- 401: no valid authenticated session.
- 403: denied merchant/account access, or existing `PLUS_REQUIRED` when enforcement denies access.
- 404: no business owned by the caller.
- 405: POST, PUT, PATCH and DELETE are unsupported.
- 503: PDF rendering is busy or temporarily unavailable; retry through the existing app feedback flow.

For permitted cross-origin web clients, `CORS_EXPOSE_HEADERS` now exposes `Content-Disposition` so the frontend can read the attachment filename. The allowed-origin list and authentication rules are unchanged. Deployment proxies must preserve these headers.

## PDF contents and limitations

The approved static layout sample is committed at [`docs/samples/merchant-report-export-sample.pdf`](samples/merchant-report-export-sample.pdf), relative to `sugbogo_backend`. See [sample review instructions](samples/README.md). Before merging, open this path on `feat/merchant-analytics-report-export`; after merging, open the same path on `main`. It contains synthetic fixtures and can be opened without running the backend or applying migrations. Actual exports use the authenticated endpoint and current owned-business evidence, not this static file.

The first page leads with profile visits, unique visitors, save events and new published reviews during the selected dates. A separate table shows current Pocket holders, all currently published reviews and the unanswered backlog. Dates and the preparation time are readable in Manila time. Recommended actions use plain messages without internal rule codes.

The following sections explain discovery/Pocket activity, selected-versus-previous period totals, recorded activity buckets, review responses and sentiment, stored review summaries, retained specialty support and anonymous peer medians. Tables use descriptive column labels and units rather than nested API field paths. Report/policy versions, the exact UTC snapshot cutoff and detailed evidence limitations appear on the final pages. This is a curated merchant presentation of the sanitized report, rather than a field-by-field JSON dump.

Identical source metadata is consolidated into numbered references, linked from the relevant result sections. Final source notes show availability, source coverage verification, reporting windows, data cutoffs and grouped explanations of partial evidence. These do not establish atomic SQL/Mongo snapshots or prove continuous event collection.

Nulls display as 'Not available', separately from real zero values. Empty tables state that no entries were recorded. Missing sparse activity buckets are not filled with zeros. All-zero specialty weeks are summarized explicitly; nonzero specialty series remain tabular. Sentiment counts remain visible, but shares are suppressed when that cohort's existing sufficient-data flag is false. Stored narrative/mentions remain behind the existing content gate and retain their own coverage. Insufficient peer samples and unavailable growth comparisons receive readable explanations. No missing comparison or metric is invented.

The renderer uses escaped text and bundled ReportLab Vera fonts, without fetching remote images, URLs or other document assets. Characters unsupported by the font are visibly represented as `[U+XXXX]`, explained in the PDF. This preserves an identifiable codepoint rather than silently rendering a missing glyph; full multilingual typography remains a later enhancement. Theme colors reuse SugboGo's existing orange and neutral values.

Resource bounds for synchronous rendering:

- At most 366 selected calendar days.
- At most 6,000 flattened evidence rows and 1,500,000 characters of serialized report/detail text under the renderer checks.
- At most 150 rendered pages and 10 MiB of PDF output.
- One active ReportLab render per process, guarded because ReportLab maintains shared font/rendering state. A concurrent render receives a controlled 503 rather than waiting indefinitely.

Exceeding a limit fails explicitly; no truncated PDF is delivered. These are export resource bounds, not statistical evidence thresholds or changes to existing analytics definitions. Production concurrency/latency must still be measured.

## Frontend coordination for Ralph

### Shared behavior

Add an explicit **Export PDF** action to the merchant report/analytics interface, using its selected dates and interval. Keep it behind the existing effective-access presentation, with backend access checks authoritative. Disable duplicate taps while a download is pending and reuse existing loading/error/button patterns.

Use the existing authenticated client, token refresh and standard API-error handling. This endpoint returns bytes on success, so do not pass its success body through a helper that expects the normal JSON envelope or read `response.data.data` from it.

An export reflects its own generation cutoff. The previously displayed analytics may have been fetched earlier, so do not promise byte-for-byte or point-in-time equivalence with that older response. The PDF includes the cutoff and policy/report versions for interpretation.

### Web download

With raw Axios, a successful request can use:

```javascript
const response = await apiClient.get(
  "/merchant/analytics/premium/report/export/",
  {
    params: { period: "30", interval: "weekly" },
    responseType: "blob",
    signal,
  },
);
```

Confirm the response is `application/pdf`, create an object URL for the returned Blob, trigger a download using a safe filename from `Content-Disposition` (or a controlled local fallback), then revoke the object URL. Handle cancellation without reporting success.

Axios error bodies may also be Blobs because of `responseType: "blob"`. For JSON error content, decode the Blob's text and parse the standard error envelope before presenting its message/code/errors. A failed PDF download must not be saved as a `.pdf` containing JSON or an HTML error page.

The server filename is exposed to allowed web origins by this branch. Do not put bearer tokens in a URL or open the protected endpoint as an unauthenticated browser link.

### Android/iOS download, preview and sharing

Fetch the protected PDF through the authenticated networking flow, then write the binary result to a local file using SDK-compatible file APIs. Check status/content type before accepting that file. Do not assume a renderer/preview component can download or authorize the file itself.

The mobile project already declares `react-native-pdf`, but it does not declare direct `expo-file-system`, `expo-sharing` or `expo-print` dependencies in the inspected package manifest. Ralph should choose and approve any required SDK-57-compatible mobile dependencies in the frontend task; this backend branch installs none of them. Existing [Expo SDK 57 sharing documentation](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) describes local file sharing on Android/iOS and its separate web limitations.

Preview or share only after the local file is complete. Keep temporary downloads separate from user-retained exports, clean temporary files through the appropriate account/logout lifecycle, and do not present another account's cached report. The app's saved-routes Offline Data screen does not automatically become a report library.

A report retained on the device or explicitly saved through the OS can be opened without internet. Creating a fresh export requires the backend connection. This feature does not supply general last-viewed offline content, offline authentication, cross-device synchronization or server-side saved-report history.

## Dependencies and integration

- Runtime dependency approved and pinned: `reportlab==5.0.1` in `requirements.txt`.
- Test-only dependency approved and pinned: `pypdf==6.21.0` in `requirements-test.txt`, which includes the runtime requirements.
- Existing Pillow and charset-normalizer satisfy the installed ReportLab requirements.
- The renderer reads fonts bundled with the pinned ReportLab package. Retain those package assets in deployment; no OS font installation or external font request is required.
- Reused the exact existing `reviews/0023_merge_review_0022_heads.py` from the engagement-heatmap branch with explicit approval, because current main still has two 0022 heads. It contains no operations and preserves both existing files. No other heatmap code was carried into this branch.
- No export model or application database migration is needed. Only disposable test databases applied migrations during verification; applying the reused graph join to an application database still needs separate approval.

## Verification

Approved commands, run from `sugbogo_backend`:

```powershell
& '..\.venv\Scripts\python.exe' -B manage.py test apps.merchant_operations.merchant_analytics apps.shared.analytics --noinput
& '..\.venv\Scripts\python.exe' -B manage.py check
& '..\.venv\Scripts\python.exe' -B manage.py makemigrations --check --dry-run
```

The verification uses real disposable PostgreSQL/PostGIS and fixture/mocked visibility observations. PDF tests parse actual generated bytes/pages with pypdf, including long-text pagination, XML/HTML escaping, Unicode fallback, null/zero/sample states, merchant-readable first-page sections, sparse bucket behavior, percentage precision, sentiment suppression, stored-content gating, owned-business isolation, denied roles/entitlements, JSON errors for PDF requests, resource limits, rendering contention and browser attachment-header access.

Synthetic preview PDFs are generated through the production services using disposable merchant fixtures and rendered to PNG with bundled Poppler for visual inspection. These contain no application data. Frontend/native download/share acceptance, live Mongo completeness, deployed load and end-to-end performance remain unverified.

Final verification results:

- **198 tests passed** in 30.468 seconds of test execution (database setup/cleanup additional), after the merchant-facing presentation revision, pagination repair and stored-summary coverage tests. Disposable test database cleanup completed.
- Django checks: no issues (0 silenced). Migration dry-run: no model changes detected.
- The initial focused run had four test-harness errors: an incorrect refresh-method mock and direct streaming-response closes that bypassed Django's test-client cleanup. These were fixed; the focused rerun passed, followed by the final complete combined selection above.
- Expected simulated Mongo outage logs occurred in passing failure-path tests.
- The revised synthetic fixture export was 6 pages and 53,769 bytes, compared with the earlier technical layout's 15 pages. All final pages were rendered with Poppler and visually inspected for table continuity, wrapping, headings, footers and page numbering. A missing stored-summary note was moved into the reading notes to eliminate an almost-empty page. This is a fixture layout sample, not a production size or performance benchmark; longer periods or available summaries can produce more pages.
- Earlier focused/combined runs and synthetic preview fixture runs overlap and are not added to the final test count.

No application data changes, mobile screen, saved-report history or AI generation are included. Staging, commit and push were subsequently authorized on 17 October 2026, together with including the approved synthetic PDF sample in the repository for review. GitHub PR creation remains with the user; PR text is supplied in chat for manual editing and submission.
