# MOB-001 through MOB-003 implementation handoff

Branch: `fix/mobile-session-and-verification-recovery`.
Base: `078db523`, which includes the earlier notification refresh preservation fix.

## Behavior

- **MOB-001:** A temporary startup failure, including HTTP 429/5xx, preserves stored credentials. Startup offers Retry and either Sign in or Offline guidance. Retry validates the stored session again. Protected content stays inaccessible until server validation succeeds. Definitive authentication rejection still clears credentials.
- **MOB-002:** Profile edits, profile photo uploads, and photo removal are pinned to the initiating account and authentication generation. Old responses cannot restore a logged-out identity or overwrite another account, including a fresh login by the same account. Uploads recheck ownership after local image processing and before sending. Obsolete profile workflows suppress success navigation and delayed success messages.
- **MOB-003:** Verification failures release loading, retain a persistent error, and offer Retry verification. Resending and returning to login remain available. Incomplete/repeated link parameters are not sent to the API. Responses finishing after navigation/unmount cannot redirect the user.

Email verification remains an existing required application flow; this change only provides recovery within it. It does not change the backend's verification requirement or automatically sign a user in.

## Coordination with Ralph

The intended merge overlap is `useRestoreSession.ts` and the root `src/app/_layout.tsx`.
No offline storage/service implementation, authentication store shape, database schema,
backend session policy, or notification recovery code was changed.

Preserve these invariants when integrating offline work:

1. Transport failure is not proof that tokens are invalid. HTTP availability failures are not proof either.
2. Cached guidance access does not authenticate API-backed screens.
3. Existing offline ownership is consulted only for a stored-token transport failure; HTTP/server failures do not add a new offline grant.
4. Retry begins a new authentication generation; late work from a previous attempt must not overwrite it.
5. Existing logout/revocation cleanup remains authoritative.

Ralph owns MOB-004 and MOB-005, and the other teammate owns MOB-006. These findings are intentionally untouched here. Existing local vouch/history test edits and seed utilities are unrelated and must not be included with this change.

## Regression verification

Focused tests cover startup HTTP rejection versus temporary failure, manual recovery,
offline-boundary preservation, profile response ownership, image preprocessing,
verification retry, incomplete links, and obsolete verification completion.
Related HTTP refresh, token storage, notification recovery, and session tests are
included in the focused regression run: **93 tests passed across eight suites**.
ESLint passed for the changed source/test files, and Git whitespace validation passed.

The repository-wide TypeScript gate already has nine errors in unrelated existing test files; this work does not expand into those repairs.

## Manual acceptance before merging

Use isolated development accounts and a controllable test backend:

1. Start while the backend returns HTTP 503: verify Retry/Sign in, no protected content, and successful restoration without entering a password after service recovery.
2. Start without network after saving eligible guidance: verify Offline guidance remains available and protected API screens stay blocked. Coordinate this case with Ralph's current offline work.
3. Reject the stored session definitively: verify normal sign-in is required and old credentials are cleared.
4. Delay profile/photo responses, end the session or change accounts, and verify the old identity and success navigation never reappear.
5. Open a verification link during a network/server failure: verify loading ends, retry succeeds after recovery, and Back to Login works. Exercise an invalid link and request a new email.

No emulator/backend fault injection or real verification-token consumption is claimed by the automated tests. No dependencies were installed and no database changes were made.
