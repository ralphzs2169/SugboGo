# Transit map configuration

Branch: `fix/transit-map-configuration`.

## Behavior

The transit workspace now shows configuration, loading, script-failure, authentication-failure and marker-capability feedback inside the existing map panel. Route lists and inspectors remain available. Click placement and dragging are paused while the map is unavailable; the browser also removes the covered map controls from keyboard interaction using `inert`.

The map remains mounted behind capability/loading feedback once its script has loaded, so a late capability change can recover without losing the surrounding editor state. A 15-second script/marker initialization timeout replaces an indefinite loading indicator with recovery instructions. Reloading remains a deliberate user action: finish or cancel unsaved edits first.

Google's documented `gm_authFailure` callback is observed as well as the Maps library loading status. The provider preserves any previous callback and restores it on unmount unless another owner has since replaced it. Error messages never include key values or raw provider exceptions. The normal APIProvider remains present for other admin maps.

## Local setup

In the ignored `sugbogo_frontend/web_app/.env`:

```dotenv
VITE_API_URL=http://localhost:8001/api
VITE_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_KEY
VITE_GOOGLE_MAP_ID=
```

Replace the placeholder with the project's existing **browser** key. Do not paste a backend/mobile credential into this file or commit real credentials. The API URL above is for the separate transit test backend, not a general production setting.

In Vite development mode only, an empty map ID resolves to Google's `DEMO_MAP_ID`, which supports advanced markers. This does not provide an API key, enable billing, bypass restrictions or certify route data. A configured map ID always takes precedence. Production has no automatic demo fallback: configure the project's JavaScript map ID before building.

From the repository root:

```powershell
cd sugbogo_frontend\web_app
npm run dev -- --port 5173 --strictPort
```

If Vite is already running, stop it in its terminal, then restart it after saving environment changes. A terminal-level `VITE_GOOGLE_MAPS_API_KEY` or `VITE_GOOGLE_MAP_ID` takes precedence over `.env`; check for stale overrides without printing secrets. Open `http://localhost:5173/admin-panel/transit-network` and sign in to the chosen backend. Do not start a duplicate process on another port and assume it is the page already open.

Google Cloud prerequisites:

- Maps JavaScript API enabled on the browser key's project, with active billing and available quota.
- Website restrictions permitting the exact local origin, normally `http://localhost:5173/*`. Add `http://127.0.0.1:5173/*` only if that address is actually used. Keep production restrictions scoped to the real site.
- A JavaScript map ID for production; it is separate from the API key.

If tiles remain dark or watermarked, inspect the browser console for Google's exact error. The application cannot repair billing, referrer restrictions, quotas or Google Cloud configuration. Not every degraded tile state is reported through a programmable failure callback; do not treat a successful script load as proof that billing and all tiles work.

References: [Google Maps errors](https://developers.google.com/maps/documentation/javascript/error-messages), [advanced marker setup and development map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/start).

## Migration and rollout

No backend changes or database migrations. Do not run `manage.py migrate` for this branch. No route fixtures, points, accounts, seed manifests, fare logic, mobile screens or transit matching rules are changed.

Restart the Vite development server for local environment changes. Production needs the correct build-time variables and a fresh web build/deployment; changing the backend environment alone cannot configure an already-built Vite bundle. Other admin map components keep their existing map-ID behavior; the development demo-ID fallback is applied to the transit map in this branch.

## Automated verification

From `sugbogo_frontend/web_app`:

```powershell
node --test src/shared/utils/googleMapsConfig.test.js src/shared/utils/googleMapsAuthFailure.test.js src/features/admin-panel/transit-network/utils/transitMapStatus.test.js src/features/admin-panel/transit-network/components/workspace/TransitMapFrame.test.js

npx eslint src/shared/utils/googleMapsConfig.js src/shared/utils/googleMapsConfig.test.js src/shared/utils/googleMapsAuthFailure.js src/shared/utils/googleMapsAuthFailure.test.js src/shared/utils/googleMapsAuthContext.js src/features/admin-panel/providers/GoogleMapsProvider.jsx src/features/admin-panel/transit-network/utils/transitMapStatus.js src/features/admin-panel/transit-network/utils/transitMapStatus.test.js src/features/admin-panel/transit-network/components/workspace/TransitMapFrame.jsx src/features/admin-panel/transit-network/components/workspace/TransitMapFrame.test.js src/features/admin-panel/transit-network/components/workspace/TransitNetworkMapCanvas.jsx

npm run build
```

Tests use dummy credentials, pure configuration/failure cases and server rendering of the actual map frame. The component tests use a separate ignored Vite cache and do not load Google, authenticate or write application data. They verify missing configuration does not mount the map, accessible status/alerts, inert controls during capability failures and interactive controls after recovery. They do not simulate real Google tiles or establish a valid Cloud key.

## Manual acceptance

Use the isolated transit backend. Do not save experimental geometry into the ordinary/shared database.

1. With an empty browser key, restart Vite and open Transit Network. Expect **Map setup needed** and recovery instructions. Existing routes and their inspectors should still load; the map must not accept placement.
2. Restore a valid browser key. In development, leave the map ID empty to exercise `DEMO_MAP_ID`; restart/reload. Confirm readable tiles and visible DEV point markers.
3. Expand DEV-DIR and select its direction. Confirm the stored path and endpoints display and the map focuses them. Exercise fullscreen and panel collapse without losing the selected route.
4. Open point creation, click the map and drag the draft marker. Confirm coordinates update; cancel to avoid changing fixtures. Open a variant editor and confirm drawing handles render; cancel without saving.
5. Exercise a blocked Google script or disconnected network in an isolated browser session. Expect failure/timeout feedback and disabled map interaction. Restore connectivity and reload after handling unsaved work.
6. A rejected key should yield auth feedback when Google emits `gm_authFailure`. Inspect the console for the actual cause; do not share URLs containing keys. Production missing-ID behavior is covered by automated tests; do not deploy a deliberately broken build for testing.

## Recorded results

Results recorded on 25 October 2026:

- Final focused run: 18 configuration/auth-callback/status/component tests passed in 2.522 seconds. Component tests rendered the actual frame through Vite SSR and React DOM server.
- Final scoped lint passed. Production build passed in 4.23 seconds. Existing build warnings concern lottie-web eval and bundle size.
- `git diff --check` and new-file trailing-whitespace/final-newline checks passed.
- Browser login to the isolated local admin succeeded. Transit Network displayed **Map setup needed** with 06B, DEV-DIR and DEV-GAP still listed; selecting 06B still opened its inspector. No route or point was created or edited during that browser check.
- User-reported acceptance after restoring the local browser configuration: live tiles, stop markers, route display and the requested map interaction checks work. The supplied screenshot shows readable tiles, three DEV-DIR markers, its fixture path and no development watermark. This manual confirmation is separate from the automated results. Google Cloud billing/restrictions were not independently audited; production configuration and injected failure-state browser checks remain pending.
- No backend/mobile suites were run because this branch changes only web map configuration and feedback. The uncommitted seed files and unrelated work remain preserved and excluded from this branch's intended commit scope.
