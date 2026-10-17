# Merchant report PDF sample

Open [merchant-report-export-sample.pdf](merchant-report-export-sample.pdf) to review the approved merchant report layout.

Repository path:

```text
sugbogo_backend/docs/samples/merchant-report-export-sample.pdf
```

Before merging, select `feat/merchant-analytics-report-export` on GitHub and browse to that path, or open it from a local checkout of this branch. After merging, use the same path on `main`. If GitHub cannot preview the PDF, download the raw file and open it in a PDF reader. Opening the sample requires no backend server, dependency installation or database migration.

The sample contains **synthetic disposable-test fixtures**, not real merchant or application data. Its fixed example period is 14 September to 13 October 2026. It is six pages and 53,769 bytes; generated reports can be longer depending on the selected dates and available evidence. The sample was generated with the production report services and visually inspected after rendering every page with Poppler.

The document demonstrates:

- Selected-period metrics separated from current totals.
- Suggested actions, discovery and Pocket activity, review responses, specialty support and peer context.
- Explicit unavailable results and insufficient review/peer samples.
- Source windows, cutoffs, reporting versions and evidence limitations on the final pages.

This is a static layout reference. It is not served as the merchant's download, does not update automatically, and does not demonstrate every data state. The actual authenticated endpoint generates a fresh report for the caller's owned business.

For the endpoint, parameters, permissions, frontend download/error handling, dependencies and verification, read [the export integration contract](../merchant-report-export-api-contract.md).
