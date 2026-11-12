# SugboGo public legal pages

The pages render without signing in and list [support.sugbogo@gmail.com](mailto:support.sugbogo@gmail.com) as SugboGo’s official contact for account support, privacy inquiries, and data-deletion requests. The pages remain drafts until the owner approves the text and confirms that the deletion process is operational.

## Implementation evidence

| Topic | Repository evidence |
| --- | --- |
| Accounts and provider data | [User model](../../../sugbogo_backend/apps/users/models.py), [authentication routes](../../../sugbogo_backend/apps/authentication/urls.py), [Google verification](../../../sugbogo_backend/apps/authentication/services/oauth/google.py), [Facebook verification](../../../sugbogo_backend/apps/authentication/services/oauth/facebook.py), and [linked accounts](../../../sugbogo_backend/apps/authentication/services/oauth/account.py) |
| Login history | The [login history service](../../../sugbogo_backend/apps/authentication/services/login_history_service.py) records method, outcome, IP, client and platform classifications, time, and a user association when available. The [backend settings](../../../sugbogo_backend/config/settings.py) specify a 90-day cutoff and a daily pruning task. Confirm that the task runs in production. |
| Location and activity | The [mobile location hook](../../mobile/src/shared/hooks/useUserLocation.ts) requests foreground location. [Explore APIs](../../../sugbogo_backend/apps/explorer_operations/explore_businesses/urls.py) cover nearby discovery, routing, and activity. [Visibility storage documentation](../../../sugbogo_backend/docs/analytics-mongodb-verification.md) describes recorded discovery events. |
| Contributions and merchant information | [Reviews](../../../sugbogo_backend/apps/reviews/urls.py), [vouches](../../../sugbogo_backend/apps/business/models/business_vouch_models.py), and [merchant applications](../../../sugbogo_backend/apps/merchant_application/models.py) cover content, activity, application and supporting-document records. [Document handling](../../../sugbogo_backend/apps/merchant_application/services/document_service.py) uses Cloudinary. |
| Third parties | The repository integrates [Google mapping](../../../sugbogo_backend/apps/shared/services/google_maps_service.py), [Resend email](../../../sugbogo_backend/apps/authentication/services/email_service.py), [OpenAI moderation](../../../sugbogo_backend/apps/reviews/services/review_moderation_service.py), [Gemini generation](../../../sugbogo_backend/apps/shared/services/gemini_structured_service.py), and gated [PayMongo checkout](../../../sugbogo_backend/config/paymongo.py), in addition to the sign-in and hosting providers. Confirm production services and the information each processes before adopting the policy. |
| Existing privacy draft | The [mobile draft](../../mobile/src/features/legal/constants/privacyPolicyDraft.ts) helped identify topics and open questions. Its content is pending approval. |

## Account deactivation and erasure

- The [deactivation service](../../../sugbogo_backend/apps/authentication/services/account_deactivation_service.py) requires an active, verified Explorer or Merchant account and proof of a usable password. It disables the account, invalidates existing sessions, and keeps related records. Accounts created solely through OAuth may need to establish a password using email recovery first.
- The [mobile-facing profile API](../../../sugbogo_backend/apps/users/views/profile_views.py) supports profile updates and removal of a custom profile photo. The review API supports deleting eligible user reviews through its [review service](../../../sugbogo_backend/apps/reviews/views/review_views.py). The [review deletion audit](../../../sugbogo_backend/docs/review-deletion-audit.md) documents separate media, audit, and aggregate handling for that feature.
- The Admin Web user-management API supports [suspension and reactivation](../../../sugbogo_backend/apps/admin_operations/user_management/urls.py). The backend also registers the [user model in Django admin](../../../sugbogo_backend/apps/users/admin.py). A generic model deletion can be blocked by protected relationships such as [business ownership](../../../sugbogo_backend/apps/business/models/business_core_models.py) and [merchant applications](../../../sugbogo_backend/apps/merchant_application/models.py). It provides no coordinated cleanup across the database, media storage, activity stores, or providers.
- The support inbox is the intake channel for deletion requests. The inspected application routes contain no end-to-end account erasure or Meta data-deletion callback.

### Manual fulfillment work requiring approval

1. Assign responsibility for monitoring the support inbox and authorize the person who can act on verified requests. Decide how to verify a requester’s identity or authority, including when they have lost access to the account email, and how to record the request securely.
2. Determine the scope of each verified request. Map affected PostgreSQL records, OAuth links, sessions, merchant ownership and applications, contributions, audit and moderation records, MongoDB discovery events, and external media.
3. Decide which records can be removed or anonymized and which must be kept. Confirm handling of protected merchant relationships, backups, and provider copies. Test the approved procedure with disposable fixtures, including feature-specific cleanup and what happens if the user signs in again.
4. Confirm the procedure verifies the result and records what was removed, what was retained, and why, so the team can communicate the outcome accurately.

## Owner decisions before publication

- Identify the responsible person or organization, confirm who monitors the support inbox, and approve the request handler and manual fulfillment procedure.
- Confirm production retention, backups, any retention exceptions, and the actual operation of sign-in history pruning.
- Confirm the production data inventory, active providers, hosting and provider retention practices, and any applicable notice details such as processing purposes and bases, recipients, and transfers.
- Approve the policy and terms effective dates, change notification process, applicable eligibility rules, and any project-specific terms or limitations.

## Cloudflare Pages and Meta fields

The existing [Admin Web deployment workflow](../../../.github/workflows/deploy-admin-web.yml) builds Vite and uploads `dist` to Cloudflare Pages. It uses the `sugbogo-admin` project and runs manually on `main`. The build has no top-level `404.html`, so Cloudflare Pages can serve the SPA entry document for each direct request. The app then renders the matching route in React Router. [Cloudflare Pages SPA rendering](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)

After owner approval and deployment, verify each URL over HTTPS in a fresh browser session. Open each URL directly, refresh it, check the heading and footer navigation, and confirm that any Cloudflare access rules permit visitors to reach the pages. Then use these fields in Meta for Developers under **App Settings → Basic**.

| Field | URL on the documented production host after deployment |
| --- | --- |
| Privacy Policy URL | [`https://sugbogo-admin.pages.dev/privacy-policy`](https://sugbogo-admin.pages.dev/privacy-policy) |
| Terms of Service URL | [`https://sugbogo-admin.pages.dev/terms-of-service`](https://sugbogo-admin.pages.dev/terms-of-service) |
| User Data Deletion → Data Deletion Instructions URL | [`https://sugbogo-admin.pages.dev/data-deletion`](https://sugbogo-admin.pages.dev/data-deletion) |

Select the appropriate **Category** from the options in the app dashboard. Review the app’s current dashboard requirements for its Facebook Login use case, access levels, review, and verification. The instructions URL is for visitors. A Meta callback, if required for the app’s configuration, requires a separate backend implementation. Live dashboard status and public access to this revision still require verification.
