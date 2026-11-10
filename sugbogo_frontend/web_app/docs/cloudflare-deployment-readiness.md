# Admin Web: Cloudflare Pages deployment readiness

Reviewed 2026-11-10 for Ralph's Phase 1 assignment.

## Result

The Admin Web installs and builds successfully locally. No Vite or router change
is required for the proposed Cloudflare Pages setup. Hosted operation and backend
integration are not verified by this check.

- Source commit: `a9ed3cee` (`feat(reviews): make Gemini authoritative for all businesses`).
- Working branch: `chore/admin-web-cloudflare-deploy`. Before committing the
  documentation, the branch was fast-forwarded to fetched `origin/main`
  (`b879f704`), which already includes the tested source commit. This keeps the
  proposed PR limited to deployment documentation.
- Runtime tested: Node `24.15.0`, npm `12.2.2` on Windows.
- `npm ci --no-audit --no-fund`: passed; 275 packages installed. This was an install
  and build check, not a dependency vulnerability audit.
- `npm run build`: passed with Vite `8.1.3`, 3,130 modules transformed and
  `dist/index.html` plus compiled assets generated.
- Existing build warnings: direct `eval` in `lottie-web` and a JavaScript chunk
  of about 3.24 MB (822 KB gzip). Performance changes are outside this assignment.
- The first sandboxed install stalled and was stopped; the clean install passed
  after permission was granted to run outside the sandbox.

## Configuration findings

| Check | Finding |
| --- | --- |
| Build script | `vite build`; use `npm run build` from the web app directory. |
| Vite output | Default `dist`, default root base `/`; suitable for a `pages.dev` origin. React, Tailwind, SVG plugin and `@` alias resolve during build. |
| Lockfile | `package-lock.json` is tracked; use `npm ci` for reproducible installation. |
| Node compatibility | Locked Vite requires `^20.19.0` or `>=22.12.0`; ESLint and PDF.js raise the Node 22 minimum to `22.13.0`. Node 22 was not executed locally. |
| API configuration | Active `apiClient` and `authClient` read `import.meta.env.VITE_API_URL`. Empty values are not rejected at build time and can cause requests to target the frontend origin. |
| Legacy API client | `src/shared/services/api.js` contains hardcoded loopback addresses. No imports of this module were found in `src`; it was left unchanged. Do not reuse it for hosted API calls. |
| Environment files | `.env.example` tracks the three required variable names without values. The local `.env` is ignored and its API URL is loopback. Real values were not copied into documentation. |
| Google Maps | Browser features use `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID`. The shared development demo map ID fallback is disabled in production. |
| Static routing | `BrowserRouter` is used; there is no top-level `public/404.html`. Cloudflare Pages supplies SPA fallback under this condition. No `_redirects` file is needed. |
| Assets | Build emits application images, CSS, JS and PDF worker. Google Fonts are fetched externally; visual loading still needs hosted browser verification. |

## Proposed Phase 2 settings

| Setting | Value |
| --- | --- |
| Project | `sugbogo-admin` |
| Plan | Free; use the generated `pages.dev` URL |
| Framework | React (Vite) |
| Production branch | `main` |
| Root directory | `sugbogo_frontend/web_app` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | Set `NODE_VERSION` to a supported Node 22 release at or above `22.13.0`; confirm it in the Cloudflare build log. |
| Automatic production deployments | Disable in the Pages project's branch deployment controls. |
| Preview deployments | Set to `None` unless the team needs them. |

These are proposed settings, not applied dashboard configuration. Keep the
lockfile committed and verify dependency installation in Cloudflare's build log.

## Environment and publication boundary

Vite embeds variables at build time. Changing a dashboard variable requires a
new build and manual deployment. Never upload the local `.env` or publish the
current local `dist` as a working production build: it uses the local API setting.

For an explicitly frontend-only test before Railway is ready, a temporary value
such as `https://api-not-configured.invalid/api` can be set for `VITE_API_URL`.
It is deliberately nonfunctional; login and all API workflows remain unverified.
This placeholder has not been applied to the local environment.

Once Ralph provides the actual Railway HTTPS API URL, set `VITE_API_URL` including
`/api`. Coordinate Django CORS for the exact Pages origin. Configure the browser
Maps key and JavaScript map ID with the appropriate website/API restrictions.
Never place Django secrets, database passwords or server credentials in `VITE_*`.

## Remaining verification

1. Merge the deployment documentation PR before using the updated repository
   on `main`.
2. Create/configure the Pages project and verify Node 22 build success there.
3. Manually deploy and record the actual URL, source commit and deployment ID.
4. Check login rendering, fonts, images, icons and browser console. Directly open
   and refresh `/login`, `/forgot-password/sent`, and `/admin-panel/dashboard`;
   the protected route should return an unauthenticated visitor to login.
5. After Railway and CORS are ready, test login, token refresh, expired sessions,
   logout, tables, filters, pagination, management workflows, media and Maps.
6. Confirm automatic production deployments remain disabled; retain the previous
   working deployment for rollback and document manual publication after the
   first real deployment has been verified.

No Cloudflare project, deployment URL, backend integration or PR has been created
as part of this local readiness check. Backend, Railway and mobile files were
not changed.

## Cloudflare references

- [Serving Pages: single-page applications](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Build image and Node version selection](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
