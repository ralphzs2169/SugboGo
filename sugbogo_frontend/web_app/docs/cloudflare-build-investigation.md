# Cloudflare Pages build failure: confirmed cause and correction

Investigated 2026-11-10. Changes are local on `fix/admin-web-independent-build`;
no push or PR is authorized for this fix.

## Exact failure and source comparison

Cloudflare built `b879f70489081469e36ea20da618948673d8dbed` with Node
`22.23.4`, npm `10.9.9`, Vite `8.1.3` and locked Rolldown `1.1.4`.
After transforming 3,129 modules, `builtin:vite-transform` failed with:

```text
Tsconfig not found expo/tsconfig.base
```

The Phase 1 build tested `a9ed3cee` using Node `24.15.0` and npm `12.2.2`.
Comparing that commit with `b879f704` shows no differences in the Admin Web
source, `package.json`, `package-lock.json`, or `vite.config.js`, nor in the
imported mobile utility or mobile tsconfig. The Vite and Rolldown versions did
not change. Package installation counts alone do not establish version drift.

## Root cause

The production import chain crosses from web into mobile:

```text
web_app/src/features/admin-panel/businesses/components/business-detail/BusinessHoursPreview.jsx
  -> web_app/src/shared/utils/businessHours.js
  -> mobile/src/features/explore/utils/businessHours.utils.ts
  -> mobile/tsconfig.json
       extends: expo/tsconfig.base
```

The web helper originally re-exported four functions from the mobile TypeScript
file. Vite 8's transform resolves the tsconfig applicable to that imported file,
which is inside mobile, even though the Vite project root is `web_app`.
The mobile tsconfig requires Expo's base config. A web-only `npm ci` does not
install mobile's Expo dependency, so resolution fails before bundling finishes.

This is triggered by an actual production import, rather than unrelated sibling
configuration scanning. There is no tracked root or web tsconfig/jsconfig in the
failed commit. The repository's only tracked tsconfig is the mobile config.

The original developer checkout already had
`mobile/node_modules/expo/tsconfig.base.json`. This masked the dependency during
Phase 1. A clean web installation inside that same populated monorepo would
still leave mobile's installed dependencies accessible, so it is not an adequate
isolation test. The earlier Phase 1 readiness check missed this boundary issue.

## Minimal correction

Replace only the web helper's cross-app re-export with a plain JavaScript
implementation of the same four functions. The existing mobile implementation
is the source for these rules; TypeScript annotations and unused mobile-only
exports are omitted. Consumers and exported names remain unchanged.

No Expo dependency, Vite downgrade, broad transform override, new tsconfig,
mobile edit, or hosting workaround is required. A trial of Rolldown's
`tsconfig: false` input option in the isolated reproduction did not stop Vite's
separate transform from failing; that trial was discarded and is not in the fix.

Add `src/shared/utils/businessHours.test.js` to compare the web implementation
with the original across 2,457 schedule/time combinations, covering all days,
opening and closing milliseconds, overnight carryover, overlapping shifts,
24-hour operation, missing/invalid times, equal times, and next-update scheduling.
It also checks the four exports, known boundary expectations and time formatting.
The mobile import is test-only; Node's type stripping does not load its tsconfig.

This preserves mobile behavior and makes the production web module independent
of mobile dependencies. The tradeoff is maintaining equivalent logic in two
files; the comparison test detects divergence when run after changes to either.

## Validation

A tracked-source snapshot of the failed commit was exported outside the developer
checkout, with the web app and the relevant mobile source/config files. No local
`.env`, parent `node_modules`, or mobile `node_modules` was copied. The web
lockfile and Vite config hashes match the repository copies.

Using Node `22.23.4` and npm `10.9.9` on Windows:

| Check | Result |
| --- | --- |
| Original source: `npm ci` | Passed; 280 packages installed. |
| Original source: `npm run build` | Failed after 3,129 modules with the exact Cloudflare Expo tsconfig error. |
| Fixed web helper: `npm ci` | Passed; 280 packages installed, with no dependency/lockfile edits. |
| Fixed web helper: `npm run build` | Passed; 3,129 modules, 3.70 seconds, `dist/index.html` and compiled assets produced. |
| Regression tests on Node 22 | All 3 tests passed, including 2,457 parity cases. |
| Mobile dependencies in isolated checkout | Absent before and after validation. |

Run the regression tests from `web_app` with:

```sh
node --experimental-strip-types --test src/shared/utils/businessHours.test.js
```

The existing Lottie `eval` and large-chunk build warnings remain. `npm ci` also
reported 17 dependency advisories (5 moderate, 12 high); dependency remediation
was not attempted as part of this focused build fix.

Validation used `VITE_API_URL=https://api-not-configured.invalid/api`, an explicitly
nonfunctional frontend-only placeholder. No credentials were used or copied.
This verifies packaging, not API integration or authenticated browser workflows.
The local reproduction is Windows, not the Cloudflare Linux image; the same
failure was reproduced before the fix, but a hosted rebuild is still required.

## Cloudflare settings after approval and publication

- Keep root `sugbogo_frontend/web_app`, command `npm run build`, output `dist`.
- Keep Node `22.23.4`; no Node downgrade or mobile installation is needed.
- Deploy the approved fix commit: retrying unchanged `b879f704` will still fail.
- Configure the real HTTPS `VITE_API_URL` including `/api` when Railway is ready;
  coordinate the Pages origin in Django CORS. Until then, label any placeholder
  deployment as frontend-only.
- Set the browser Google Maps variables when validating map features, then rebuild.
- Keep automatic production deployments disabled and restrict preview deployments
  as requested in the roadmap.

No Django, Railway, Redis, Celery, mobile, Vite, package or lockfile changes are
part of this correction. Hosted validation and integration remain pending.
