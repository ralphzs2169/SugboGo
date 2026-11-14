# SugboGo authentication link fallback

These static assets belong to the `sugbogo-links` Cloudflare Pages project, which serves `sugbogo.app`. Cloudflare Pages serves `verify-email.html` and `reset-password.html` at the corresponding extensionless paths.

1. Add the contents of `public/` to the existing site's upload root. Keep its landing page and unrelated files. If it already has a `_headers` file, incorporate these rules and remove any conflicting rules for these paths. Keep the `.well-known` directory in the upload, including any existing association statements for other supported app builds.
2. Review the project's analytics and logging settings. Keep Web Analytics and Zaraz scripts off these pages. Exclude the query string for these paths from any request-log exports. The pages contain only static instructions and neither read nor forward the query string.
3. For a Direct Upload project, open **Workers & Pages → sugbogo-links → Create deployment** and upload the assembled folder. For a Git-integrated project, add the files to its configured publish directory. Deploy a preview first to check the response headers and both fallback pages.
4. After publishing the assembled site to the custom domain, verify all three paths with HTTPS GET requests. Use dummy query values for testing and keep real recovery links out of terminal history. The association URL should return HTTP 200 without redirects, with `Content-Type: application/json`, package `com.sugbogo.app`, and the signing fingerprint of the installed APK. The fallback pages should render without redirects and return `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.

```sh
curl -i https://sugbogo.app/.well-known/assetlinks.json
curl -i 'https://sugbogo.app/verify-email?uid=example&token=example'
curl -i 'https://sugbogo.app/reset-password?uid=example&token=example'
```
