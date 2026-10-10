# Notification WebSocket setup and client contract

## Runtime setup

### Local Redis with Docker Desktop (Windows)

Install Docker Desktop with the WSL 2 backend, complete any requested Windows restart, and open Docker Desktop until its engine is running. Initial setup may ask you to review and accept Docker's terms.

Check for an existing container before creating one:

```powershell
docker version
docker ps -a --filter name=sugbogo-redis
```

If no container with that name exists:

```powershell
docker run --detach --name sugbogo-redis --publish 127.0.0.1:6379:6379 --restart unless-stopped redis:7-alpine
docker exec sugbogo-redis redis-cli ping
```

Expected Redis response: `PONG`. If the container already exists but is stopped, use `docker start sugbogo-redis` rather than creating a duplicate. Binding to 127.0.0.1 keeps this development service local. The persistent inbox remains in PostgreSQL; Redis channel data is transient. No production Redis service is provisioned by these commands.

The backend requires Channels 4.3.2, channels-redis 4.3.0, and Daphne 4.2.3 in addition to its existing dependencies. PostgreSQL stores the inbox; Redis distributes transient recipient signals. A Redis outage does not erase saved notifications.

Set these values in the deployment environment or your local `.env` (the branch only updates `.env.example`):

```dotenv
NOTIFICATION_REDIS_URL=redis://127.0.0.1:6379/1
NOTIFICATION_WS_ALLOWED_ORIGINS=http://localhost:5173
```

For production, use the actual allowed browser origin(s), comma-separated, and provision a reachable authenticated Redis service. Do not expose Redis publicly. The origin allowlist matches exact origins; it does not inherit wildcard ALLOWED_HOSTS. The notification Redis URL is independent of CELERY_BROKER_URL and uses a notification-specific channel prefix.

From `sugbogo_backend`, run the ASGI application with the configured Python environment:

```powershell
python -m daphne -b 127.0.0.1 -p 8000 --websocket-max-message-size 8192 config.asgi:application
```

The existing plain Django `runserver` setup is not changed to serve sockets; use the ASGI command above. A production reverse proxy must forward WebSocket upgrades and terminate TLS so clients use WSS. Configure connection limits at the server/proxy; REST throttling does not apply to WebSocket handshakes. This branch does not provision or modify a deployed server or install a Redis service.

## Client flow

1. Open `ws://localhost:8000/ws/notifications/` locally or `wss://<backend>/ws/notifications/` in production. Do not put tokens in the URL.
2. Within five seconds, send exactly:

```json
{"type":"authenticate","access":"<current access JWT>"}
```

3. After successful authentication, the server sends:

```json
{"type":"inbox.ready","sync_required":true}
```

4. Refetch `GET /api/notifications/` and `GET /api/notifications/unread-count/` using the existing REST JWT authentication.
5. Committed creation/read-state changes trigger:

```json
{"type":"inbox.changed","sync_required":true}
```

6. Refetch the inbox/count again. Coalesce closely spaced signals in the frontend rather than assuming signals are notification items. Continue to mark items read through REST.

The server derives the recipient group from the validated JWT. Clients cannot select recipients, send broadcast messages, create notifications, or mutate read state over this socket. Signals contain no notification text, recipient IDs, event keys, or administrator evidence. Native clients may omit Origin but must still authenticate. Browser connections require an allowlisted Origin.

Reconnect after refreshing an expired access token using the existing REST refresh flow. Fetch current inbox/count on every ready signal; disconnected clients can miss live signals. Do not assume one signal per item or guaranteed event delivery. Use bounded reconnect backoff and REST recovery if the channel service is unavailable. Frontend reconnect logic and badge wiring are not implemented in this backend branch.

## Close behavior

| Code | Meaning |
| --- | --- |
| 4400 | Invalid protocol/frame, query-string credentials, or unsupported client messages |
| 4401 | Invalid/expired access JWT or authentication deadline exceeded |
| 4403 | Browser origin rejected or connected account no longer eligible |
| 1011 | Channel-layer connection failure during group subscription |

No group membership or private-user signal is permitted before authentication. Connections close at access-token expiry. Account state is rechecked before each signal and at most every 30 seconds while idle. An account disabled before authentication is rejected through the existing JWT authentication rules.

## Commit and outage semantics

Existing decision transactions still save PostgreSQL notifications atomically with the decision. Socket signals publish through transaction.on_commit, so rolled-back work emits nothing. Duplicate creation and repeated read requests do not emit new signals. Changed bulk-read operations notify all connected devices of that recipient.

Redis publication is best effort with a two-second total timeout per signal and one-second Redis socket timeouts. Publication failures log a generic warning without token/provider-credential contents and do not undo committed notifications or decisions. The HTTP response may wait briefly for the bounded after-commit attempt. There is no durable realtime retry queue in this branch; the REST inbox is authoritative.

## Verification

```powershell
python manage.py test apps.notifications.tests.test_notification_sockets apps.notifications.services.tests.test_notification_publication --noinput
python manage.py makemigrations --check --dry-run
```

Socket tests use Channels communicators and an in-memory channel layer, with disposable PostgreSQL/PostGIS fixtures. They do not certify a production reverse proxy, TLS, or Redis installation. Record real Redis/deployment smoke-test results separately before rollout.
