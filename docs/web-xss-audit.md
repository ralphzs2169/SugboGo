# Web admin XSS audit â€” Task 5

No `dangerouslySetInnerHTML`, `innerHTML`, or literal `javascript:` sinks were found before this change. Reviews, business names, tags, and notes use React text rendering. Token storage is unchanged.

Document/evidence links and remote image sources now use `safeHttpUrl`. It allows HTTP(S) and same-origin paths and rejects executable/data schemes, control characters, backslashes, and protocol-relative URLs. Trusted built-in avatar fallbacks remain intact. Generated document-preview blobs require explicit opt-in. Telephone/email links use fixed `tel:`/`mailto:` schemes. Imported logos and the generated Google static-map URL are trusted code assets.

## Proposed Caddy header for the production admin host

Replace the API origins with the deployed HTTPS/WebSocket origins. Begin with Report-Only and inspect browser violations during login, maps, notifications, images, and PDF previews. Switch the header name to `Content-Security-Policy` after verifying those flows. This proposal is not installed by this commit.

```caddyfile
header {
    Content-Security-Policy-Report-Only "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.example.com wss://api.example.com https://*.googleapis.com https://*.gstatic.com; worker-src 'self' blob:; form-action 'self'; upgrade-insecure-requests"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
}
```

Production Vite scripts are served from the built site. Inline styles remain allowed for existing map/chart/style attributes. The bundled PDF.js worker and generated blob previews are permitted. Google Maps/fonts/API/notification origins must match deployment. This policy still requires browser verification.

Keep this production policy separate from local Vite development: HTTP development cannot use `upgrade-insecure-requests`; HMR needs its WebSocket origin in `connect-src`, and injected inline scripts/styles need an appropriate nonce or a development-only policy. Vite supports `html.cspNonce`; production nonces must be generated per response. No dependency or development-server CSP was added.

Sources: [Vite CSP documentation](https://vite.dev/guide/features.html#content-security-policy-csp), [Caddy header directive](https://caddyserver.com/docs/caddyfile/directives/header).

## Validation

`npm test` uses Node's built-in runner and the existing tests, plus URL-policy tests. `npm run build` checks the production bundle. Browser verification of deployed origins and CSP enforcement remains pending. URL guards/CSP reduce exposure, but localStorage tokens remain accessible to any future same-origin script injection.

The final production build passed. It reports the existing `lottie-web` direct-eval warning and a large main bundle. The proposed policy omits `unsafe-eval`, so Lottie expression-based animations, if used, would be blocked under enforcement; verify them in Report-Only first. No dependency was changed to address those separate findings.

The final serial test run passed 129 of 135 tests. Six moderation-layout assertions also fail with these changes removed (`ModerationIntegrityPage.test.js`): queue photo/reply/edit context, selected detail text/photo findings, reported detail decision context, reported summary badge, community-report timestamps/reasons, and dialog minimum-note copy. They were left unchanged.

## Every dynamic URL hit before the change

Locations below precede the added imports and guards. Trusted assets and navigation URLs are included for completeness.

| Source:line | Expression |
|---|---|
| `sugbogo_frontend/web_app/src/features/auth/components/LoginIllustration.jsx:13` | `<img src={SugboGoLogo} alt="SugboGo Logo" className="h-8 w-auto" />` |
| `sugbogo_frontend/web_app/src/features/auth/components/LoginIllustration.jsx:22` | `src={adminLoginIllustration}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-update-requests/columns/businessUpdateRequestColumns.jsx:102` | `src={row.original.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/shared/components/UserAvatar.jsx:29` | `src={source}` |
| `sugbogo_frontend/web_app/src/shared/components/SugboGoText.jsx:26` | `src={SugboGoLogo}` |
| `sugbogo_frontend/web_app/src/shared/components/SugboGoText.jsx:34` | `src={SugboGoLogo}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/ApproveApplicationConfirmationModal.jsx:36` | `src={storefrontPhoto}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/business-documents/DocumentPreview.jsx:31` | `src={url}` |
| `sugbogo_frontend/web_app/src/features/auth/components/common/AuthSplitLayout.jsx:16` | `<img src={SugboGoLogo} alt="SugboGo Logo" className="h-8 w-auto" />` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/BusinessDocumentsReview.jsx:46` | `href={document.document_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/BusinessDocumentsReview.jsx:72` | `href={document.document_url}` |
| `sugbogo_frontend/web_app/src/shared/components/modals/ReviewPhotoViewerModal.jsx:130` | `src={currentPhoto.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/business-photos/BusinessPhotoPreviewModal.jsx:122` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-applications/components/review/business-photos/BusinessPhotoGallery.jsx:34` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/columns/businessColumns.jsx:70` | `src={photoUrl}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/business-update-requests/components/UpdateRequestSidebar.jsx:82` | `src={coverPhotoUrl}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-location/BusinessMapInfoWindow.jsx:19` | `src={photoUrl}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessContactPreview.jsx:29` | `href={`tel:${contactNumber}`}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessContactPreview.jsx:39` | `href={`mailto:${email}`}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessContactPreview.jsx:49` | `href={website.startsWith("http") ? website : `https://${website}`}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessDetailContextBar.jsx:38` | `src={business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessDetailHero.jsx:46` | `src={business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessDetailLocation.jsx:65` | `src={storefrontPhoto.url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/dashboard/components/BusinessListItem.jsx:30` | `src={image}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessLocationPreview.jsx:80` | `src={staticMapUrl}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessPhotosPreview.jsx:134` | `src={featuredPhoto.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/BusinessPhotosPreview.jsx:156` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/moderation/components/ReviewContentCard.jsx:54` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/moderation/components/ReviewIdentityHeader.jsx:114` | `src={review.business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/review-preview-section/ReviewContentPreview.jsx:57` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/review-preview-section/ReviewPreviewModal.jsx:48` | `src={src}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/businesses/components/business-detail/review-preview-section/ReviewPreviewModal.jsx:181` | `src={photo.photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/under-review/components/QueueItem.jsx:94` | `<img src={businessCoverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />` |
| `sugbogo_frontend/web_app/src/features/admin-panel/msme/components/MsmeTable.jsx:112` | `src={row.image}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/discovery-scores/columns/discoveryScoreColumns.jsx:28` | `src={business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/review-disputes/components/DisputeIdentityHeader.jsx:101` | `src={business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/review-disputes/components/DisputeQueueItem.jsx:81` | `src={dispute.business_cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/transit-network/hooks/useUnsavedChangesGuard.js:33` | `const destination = new URL(anchor.href, window.location.href);` |
| `sugbogo_frontend/web_app/src/features/admin-panel/transit-network/hooks/useUnsavedChangesGuard.js:34` | `const current = new URL(window.location.href);` |
| `sugbogo_frontend/web_app/src/features/admin-panel/transit-network/hooks/useUnsavedChangesGuard.js:86` | `const destination = new URL(pendingDestination, window.location.href);` |
| `sugbogo_frontend/web_app/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeEvidence.jsx:58` | `href={item.url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeEvidence.jsx:86` | `src={item.url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/reported-reviews/components/QueueItem.jsx:49` | `<img src={businessCoverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />` |
| `sugbogo_frontend/web_app/src/features/admin-panel/suspicious-reviews/components/RelatedReviewRow.jsx:98` | `src={business.cover_photo_url}` |
| `sugbogo_frontend/web_app/src/features/admin-panel/suspicious-reviews/components/QueueItem.jsx:39` | `<img src={review.business.cover_photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />` |
