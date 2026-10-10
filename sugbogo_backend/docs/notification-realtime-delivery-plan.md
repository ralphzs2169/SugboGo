# Notification realtime delivery implementation and validation

Branch: `feat/notification-realtime-delivery`
Base: `633d093` (event integration; merge preceding branches first).
Status: infrastructure/socket contract approved; implemented and tested locally; awaiting staging/commit approval.

## Verified starting point

The repo has HTTP-only Django ASGI configuration, SimpleJWT REST authentication, and a Celery broker environment variable. It has no Channels dependencies, channel layer, WebSocket routes, or verified WebSocket deployment configuration. The persistent inbox and approved event producers are present on this branch.

## Infrastructure proposal

Add Django Channels, channels-redis, and Daphne (ASGI server), with compatible dependency versions verified during implementation. Add ASGI protocol routing while retaining Django HTTP routing. Configure Redis through a dedicated notification channel-layer URL, independently of the Celery broker. Use the in-memory channel layer only in tests. Update environment/setup documentation; do not alter local secrets, install Redis system-wide, or change a deployed service.

PostgreSQL remains the durable inbox. Redis distributes transient events across backend processes; it does not replace notification storage. Deployment must run an ASGI server and permit WebSocket upgrades. No deployment setup has been verified in the repo.

## Socket contract proposal

- Route: `/ws/notifications/` (production connections use WSS).
- The client sends an initial JSON message containing an access JWT and an `authenticate` message type within five seconds. Do not put JWTs in URLs. No private data or recipient-group membership before successful authentication.
- Validate the token with the existing JWT settings and resolve its active user from the database. The server determines the recipient group; clients cannot select user IDs or group names.
- Restrict browser origins to an explicit configured allowlist. Allow requests without an Origin header for native clients, still requiring JWT authentication. Do not reuse the current wildcard ALLOWED_HOSTS as an origin policy.
- Close the socket at token expiry. Recheck active account status before delivering events and periodically while connected. Clients refresh through existing REST authentication and reconnect.
- After authentication, send a ready/sync signal. Send `inbox.changed` signals after notification creation and read-state changes, scoped only to that recipient. Signals prompt the client to refresh inbox/unread-count REST queries; they do not contain private evidence or event keys.
- All read mutations remain on the existing REST APIs. No client notification creation, recipient selection, or arbitrary broadcast messages.
- Multiple devices for the same authenticated recipient receive the same change signal. On reconnect, clients refetch the authoritative REST inbox/count rather than assuming every socket event was delivered.

## Failure and transaction contract

Publish signals through transaction.on_commit only after durable inbox changes commit. Catch/log Redis delivery failures without leaking JWTs or rolling back successful decisions. The saved PostgreSQL inbox remains retrievable. This branch offers best-effort live signals, not guaranteed delivery or a durable retry queue.

Read-one signals should be emitted only when read state changes; repeat reads and duplicate event creation should not produce redundant signals. Read-all emits only when it updates items. Rolled-back decisions must emit nothing.

## Verification

Test HTTP routing preservation, initial authentication timeout, invalid/expired tokens, account disablement, origin validation, recipient isolation, reconnect sync, token expiry, multiple sockets, commit/rollback behavior, duplicate/read idempotency, and Redis publication failure preserving durable decisions. In-memory tests prove application behavior; record separately whether a real Redis/ASGI integration smoke test is possible. No frontend or push implementation in this branch.

## Recorded results (2026-10-05)

### Follow-up verification (2026-10-11, Asia/Manila)

- The 17 socket/publication regression tests passed again on October 10.
- After merging origin/main at 82b9d9e, all 135 notification, admin moderation, and merchant business-profile tests passed on October 11. The overlapping classification test changes merged cleanly.
- Local Docker Redis responded to PING and the configured Redis channel layer delivered a transient group message.
- A real local Daphne server passed a network WebSocket smoke test against disposable PostgreSQL fixtures: signed access-token authentication, recipient isolation, notification creation signals, read-state signals, and reconnect synchronization. The temporary server stopped and the test database was removed successfully.
- The smoke harness lives in the ignored local test environment. It does not verify production TLS/proxy configuration or implement frontend synchronization. Automated tests cover simulated Redis failures; a live Redis outage has not been exercised.
- Updated origin/main at 82b9d9e contains no new committed changes to reviews, notifications, or config relative to this branch base. Merchant classification tests changed on main and must be reconciled when integrating the branch.

- 17 focused socket/publication tests passed. The final combined notification, moderation, and merchant name/classification/location decision run passed all 181 tests.
- The combined run includes a decision-level test proving that Redis publication failure preserves the approved report, rejected review, two saved notifications, audit entry, and reputation events.
- Updated classification tests to assert both discovery refresh and recipient publication after approval; rejection publishes without discovery recomputation.
- Django system checks passed and migration consistency reported no changes. No development-database migration was applied.
- Pinned Channels 4.3.2, channels-redis 4.3.0, and Daphne 4.2.3 using official package metadata. Installed them only in the isolated test environment. The pre-existing requirements file was UTF-16; converted it to UTF-8 and verified all existing requirement lines were preserved apart from these three additions.
- The Daphne CLI loads successfully. Socket/application tests use Channels communicators with an in-memory layer and disposable PostgreSQL/PostGIS databases.
- Real local Redis could not be reached on 127.0.0.1:6379, including an outside-sandbox check. Therefore real Redis fan-out, an actual network WebSocket handshake, and deployed proxy/TLS delivery are not verified. No Redis service or deployed server was changed. Some existing transaction tests exercised the graceful publication-outage path against the unavailable default Redis.
- The previously documented merchant own-business like policy mismatch remains unchanged and outside this targeted run.

Setup and client messages: see `notification-websocket-setup.md`. The five-second authentication timeout and 30-second idle account check are server-controlled. Signal publication is capped at two seconds per attempt; brief HTTP response latency from after-commit publication is documented. Reconnection recovery remains through REST; there is no guaranteed live-event replay.

## Local infrastructure setup (2026-10-06)

With explicit user approval, downloaded official Microsoft WSL and Docker Desktop installers into the ignored local test-environment directory and verified valid Microsoft/Docker signatures. WSL 3.0.1 installed successfully. VirtualMachinePlatform enablement returned 3010 (restart required), with automatic restart disabled. Docker Desktop per-user installation with the WSL 2 backend returned exit code 0. Redis container creation and real delivery verification remain pending the user's manual Windows restart and Docker Desktop initial startup. No restart was initiated, no Redis container was created yet, and no deployment was modified.

References: https://channels.readthedocs.io/en/stable/topics/channel_layers.html ; https://channels.readthedocs.io/en/stable/topics/security.html ; https://channels.readthedocs.io/en/stable/deploying.html
