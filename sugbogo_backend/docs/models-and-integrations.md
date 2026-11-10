# Sentiment models and external integrations

Run commands from `sugbogo_backend`. Use the existing Linux/amd64 image described
in [Linux build](linux-build.md) and the independent services in
[Cloud services](cloud-services.md). This guide provisions existing artifacts;
it does not change models, scoring, schedules, authentication or payment flows.

## Reviewed model bundle

| Artifact | Bytes | Linux worker path |
| --- | ---: | --- |
| fastText `lid.176.bin` | 131,266,198 | `/opt/sugbogo/models/lid.176.bin` |
| Tagalog `pytorch_model.bin` | 436,403,569 | `/opt/sugbogo/models/tagalog/pytorch_model.bin` |
| Tagalog `config.json` | 908 | Same Tagalog directory |
| Tagalog `merges.txt` | 268,842 | Same Tagalog directory |
| Tagalog `special_tokens_map.json` | 957 | Same Tagalog directory |
| Tagalog `tokenizer.json` | 1,246,869 | Same Tagalog directory |
| Tagalog `tokenizer_config.json` | 1,365 | Same Tagalog directory |
| Tagalog `vocab.json` | 468,698 | Same Tagalog directory |

Together these require **569,657,406 bytes (543.3 MiB)**, plus notices and a small
filesystem allowance. VADER's lexicon is already included in the pinned
`vaderSentiment` package; no NLTK corpus download is required.

`scripts/sentiment_models.json` records exact sizes and SHA-256 hashes of the
existing local files. All seven Tagalog files were compared against publisher
metadata at revision `3355ad5a830178573c59684adf149d6544f3d86f` of
[`dost-asti/RoBERTa-tl-sentiment-analysis`](https://huggingface.co/dost-asti/RoBERTa-tl-sentiment-analysis/tree/3355ad5a830178573c59684adf149d6544f3d86f):
the weight LFS SHA-256 and the small-file Git blob IDs matched. The fastText hash
is a reviewed **local baseline**; the official download's size matched, but its
upstream page did not supply an independent SHA-256. No model was downloaded or
replaced during this task. Do not treat a matching local hash as a publisher signature.

## Licensing gate before copying to hosting

- The [official fastText language-model page](https://fasttext.cc/docs/en/language-identification.html)
  licenses these models under **CC BY-SA 3.0**. Preserve attribution, license
  links/notices and applicable share-alike obligations when distributing or
  adapting them. The fastText library's license does not replace the weights' license.
- The pinned Tagalog model's card and repository metadata declare **no license**.
  Confirm permission and required notices with DOST-ASTI before hosted copying or
  redistribution. Public download access and the Transformers software license
  do not establish permission for these weights. This remains unresolved.
- Preserve the packaged [VADER MIT notice](https://github.com/cjhutto/vaderSentiment/blob/master/LICENSE.txt).

Retain source/revision information and the applicable notices with the model
bundle, outside Git. Do not publish a model archive/image until the license gate
is resolved. No automatic download or third-party mirror is introduced.

## Provision once; mount into the worker read-only

After permission is confirmed, copy the reviewed existing files into a retained
host directory or persistent volume with this layout:

```text
/persistent/sugbogo-models/
    lid.176.bin
    tagalog/
        config.json
        merges.txt
        pytorch_model.bin
        special_tokens_map.json
        tokenizer.json
        tokenizer_config.json
        vocab.json
    notices/
```

Keep the originals unchanged and outside the Docker context. These binaries stay
out of Git and image layers. The image's `sugbogo` user needs read permission on
files and search permission on parent directories (typically files `0644`,
directories `0755` for these non-secret artifacts). It needs no write access.
Use restrictive permissions appropriate to any additional files in the volume.

Configure the worker's environment with absolute **container** paths:

```dotenv
FASTTEXT_LID_MODEL_PATH=/opt/sugbogo/models/lid.176.bin
TAGALOG_SENTIMENT_MODEL_PATH=/opt/sugbogo/models/tagalog
```

Verify the staged bundle before starting background work; this command only
reads/hashes files and makes no provider requests:

```sh
docker run --rm --network none \
    --env FASTTEXT_LID_MODEL_PATH=/opt/sugbogo/models/lid.176.bin \
    --env TAGALOG_SENTIMENT_MODEL_PATH=/opt/sugbogo/models/tagalog \
    --env HF_HUB_OFFLINE=1 \
    --mount type=bind,src=/persistent/sugbogo-models,dst=/opt/sugbogo/models,readonly \
    sugbogo-api:local python scripts/verify_sentiment_models.py
```

Add `--smoke-test` after the script name for one optional bounded check through
the actual English/VADER and Tagalog/transformer pipeline. It loads models,
reports process RSS/peak RSS on Linux, and needs substantially more memory than
hash verification. It is a provisioning check, not a startup hook or benchmark.
On Windows the same script uses existing `.env` paths, without modifying `.env`.

For the worker, retain the same mount and use protected runtime configuration:

```sh
docker run --rm --env-file /secure/path/backend.env \
    --env CELERY_WORKER_CONCURRENCY=1 \
    --env FASTTEXT_LID_MODEL_PATH=/opt/sugbogo/models/lid.176.bin \
    --env TAGALOG_SENTIMENT_MODEL_PATH=/opt/sugbogo/models/tagalog \
    --env HF_HUB_OFFLINE=1 \
    --mount type=bind,src=/persistent/sugbogo-models,dst=/opt/sugbogo/models,readonly \
    sugbogo-api:local python -m celery -A config worker \
    --loglevel=INFO --queues=celery,gemini_sentiment_shadow
```

The optional queue subscription preserves existing recovery routing; keep
`GEMINI_SENTIMENT_SHADOW_ENABLED=False` and
`GEMINI_SENTIMENT_CUTOVER_ENABLED=False`. It does not enable experimental inference.
The API and Beat do not need this model mount: the existing pipeline loads lazily
when inference is called. Any manual sentiment repair command also needs the mount.
Do not preload the models in Django startup or in every service process.

Reattach the **same retained directory/volume** after replacing the worker.
Container overlay storage and temporary directories do not preserve the bundle.
No paid object store or model server is needed. A provider must support the mount
and its permissions; provision it once rather than fetching models on every boot.

## Runtime and failure behavior

The unchanged implementation is in `apps/reviews/services/sentiment.py`: fastText
routes confidently English text to VADER and other text to the pinned Tagalog
model. Transformer loading uses `local_files_only=True`, `trust_remote_code=False`
and `weights_only=True`, CPU inference and one PyTorch compute thread. Do not
load untrusted replacement pickle weights or update the checksum manifest to
accept an unexplained mismatch.

Missing paths/files fail when inference is requested, rather than downloading a
replacement. `apps/reviews/tasks.py::process_review_sentiment` logs the failure
and returns `failed`; it does not automatically retry that exception immediately.
Existing summary reconciliation/manual repair paths can recover after provisioning.
Confirm the worker's bundle before accepting real review traffic.

Concurrency **1** remains the starting point. A Celery parent, Django imports,
moderation/insight work, the API, database, Redis and MongoDB require additional
memory beyond this standalone inference measurement. Multiple worker children
may each retain models. Measure container peaks during a representative workflow
before purchasing a small plan; a successful build is not a memory guarantee.
Retained model storage is additional to the image and database storage. Provider
RAM/CPU/storage pricing and AI/maps/email usage must be checked after selecting
hosting; no monthly total is established here.

This check verifies loading and routing, not classification accuracy. Existing
Cebuano/ambiguous-language routing and documented Tagalog negation limitations
are preserved. Model-quality changes require a separate task.

### Local Linux validation measurement (2026-11-10)

The existing files passed all eight size/hash checks and both inference routes
inside the Linux image, running as `sugbogo` with networking disabled and read-only
model mounts. The originals were not modified.

| Stage | Process RSS | Observed wall time / process CPU time |
| --- | ---: | --- |
| Before inference imports | 24.1 MiB | Not timed |
| English, fastText + VADER | 169.9 MiB | 1.096 s / 0.648 s |
| Tagalog, including cold transformer load | 835.4 MiB | 14.904 s / 11.769 s |

Linux `ru_maxrss` reported 835.0 MiB at the last stage; `/proc` RSS and resource
accounting differ slightly. These are single-process diagnostics on local Docker,
not container-wide peaks, hosted latency guarantees or throughput benchmarks.
A 512 MiB worker limit is below the observed inference working set. Leave material
headroom above this measurement for Celery/Django and other worker tasks; start
with concurrency 1 and measure the complete hosted workflow before increasing it.
The production Django/ASGI import plus URL system check, with no models mounted,
used 175.6 MiB RSS in a separate process and left the model cache empty. This is
an import baseline, not a serving API or full Celery measurement. Docker reported
507,039,401 bytes for the image; host layer extraction/cache accounting may differ.

## External integration configuration

All keys belong in runtime secrets, never build arguments or Git. No real provider
calls or account-console changes were made. Unless stated below, missing keys do
not prevent settings import, but the corresponding feature cannot operate.

| Integration | Required for existing features / environment | Hosted requirements and unverified behavior |
| --- | --- | --- |
| Resend | Email verification, invitations, recovery: `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, `WEB_APP_URL`, `MOBILE_SCHEME` | **Missing key raises on email-service import**, including URL checks/worker checks. Use a verified sender/domain; the default `onboarding@resend.dev` is restricted to provider testing. Configure real HTTPS frontend links and test installed-app deep links. |
| Cloudinary | Media/document flows: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Existing secure configuration, upload and signed-document helpers remain. Verify account upload/delivery/delete permissions, document/PDF delivery and quota; no local upload volume replaces this service. |
| Google OAuth | Google login: `GOOGLE_OAUTH_CLIENT_ID` | **Set the intended audience before exposing OAuth**: the existing Google verifier receives this value and a missing audience can skip audience checking. Match release Android OAuth client/package/signing configuration and returned token audience. Current native custom-scheme/browser flow still needs a real APK/provider test; registration alone does not establish that Google accepts it. |
| Facebook OAuth | Facebook login: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Existing app-ownership validation remains. Configure release package/key hashes, matching native app credentials and provider mode/testers/review permissions including email. Real token flow remains unverified. |
| Google Maps/Places/Geocoding/Routes | Maps and navigation features: backend `GOOGLE_MAPS_API_KEY` | Enable the APIs actually used, billing and quotas. Restrict server, Android and browser keys appropriately; use separate keys for different restrictions. Actual host egress/IP restrictions, release signing and browser origins need verification. |
| OpenAI moderation | Normal automated review publication: `OPENAI_API_KEY`, `OPENAI_MODERATION_MODEL` | Missing key returns `provider_failure`; existing hold/recovery behavior remains, rather than silently publishing. Confirm model access/quota later; no public callback required. |
| Gemini | Existing keywords/narratives/recommendations: `GEMINI_API_KEY`, `GEMINI_KEYWORD_MODEL`, `GEMINI_TIMEOUT_SECONDS` | Missing key yields existing unconfigured/provider error paths. Confirm configured model availability and quota with the intended account. Both experimental sentiment flags stay **False**. No public callback required. |
| PayMongo foundation | **Not required while checkout is disabled** | Keep `PAYMONGO_CHECKOUT_ENABLED=False`. Confirmation/webhook processing and entitlement activation are incomplete; existing credentials/return-URL settings do not make payments ready. No checkout or webhook is activated. See [payment foundation](payment-foundation.md). |

Email links actually use `WEB_APP_URL` for `/admin/setup-account`, `/verify-email`
and `/reset-password`, and `MOBILE_SCHEME` for mobile verification/recovery. The
`BACKEND_URL`, `EMAIL_VERIFICATION_URL` and `PASSWORD_RESET_URL` settings currently
have no consumers outside settings; changing those alone does not update links.
There is no incoming Resend webhook requirement in the current email flow.
The current Admin `src/App.jsx` has reset/invitation routes but no `/verify-email`
route. If the web verification variant is included, its destination requires a
separate frontend task; changing the backend URL variables cannot supply that page.

OAuth backend endpoints verify tokens supplied by clients; they are not browser
authorization-code callback handlers. Provider-console redirects must correspond
to the existing client flows. Inspect/test the installed release APK and Admin
URLs before adding any redirects; do not invent a backend callback route.
The existing mobile Google flow uses `com.sugbogo.app:/oauthredirect`.

Client-side configuration is a later build/hosting task: existing names include
`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_FACEBOOK_APP_ID`,
`EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`,
`EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID`, `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID`.
Never place backend secret keys in these public client variables. Client files
are unchanged in Task 2D.

## Hosting acceptance gates

1. Resolve Tagalog model permission; retain attribution/notices and the reviewed bundle.
2. Select sufficient worker memory and persistent storage; verify read-only mounts
   as the image user, run hashes, then one offline inference smoke check.
3. Supply Resend and the credentials for features included in the defense. Configure
   the verified sender, HTTPS frontend/email links and native OAuth registration.
4. Verify controlled email/upload/login/map/review workflows with appropriate
   account quotas/billing limits. These real interactions were not tested here.
5. Keep payments and experimental sentiment disabled. Follow the existing separate
   API/worker/Beat commands and database release procedure.

## Focused validation record (2026-11-10)

- The Linux image rebuilt successfully using cached dependency layers; GIS/CPU
  imports passed. A build attempted with `--network=none` could not retrieve apt
  indexes after changing its build cache key; normal cached build mode succeeded.
  Dependency installation still requires package-repository access.
- Eight real artifacts passed checksum verification on Windows and Linux.
  Actual offline English and Tagalog inference passed on Linux as measured above.
  A fresh container reverified the same mounted files after the inference container
  was removed, confirming retained-file access across replacement without reloading.
- **75 focused Linux tests passed**: production settings, new provisioning and
  mocked integration checks, existing sentiment/scoring/task, Cloudinary, PayMongo
  and moderation service checks. No database setup or provider networking was used.
- Production ASGI import and `manage.py check` passed with a generated test secret,
  dummy Resend key, no models and external networking disabled. Image inspection
  found no `/app` dotenv files or model binaries. This does not validate real credentials.
- The broader **103-test Windows selection had 98 passes and 5 existing failures**:
  four Google Maps mocks expect a 10-second timeout while
  `apps/shared/services/google_maps_service.py:18` configures 20; the Google Routes
  mock expects `TRAFFIC_UNAWARE` while
  `apps/shared/services/google_routes_service.py:81` sends `TRAFFIC_AWARE`.
  These implementations and their tests were unchanged. Resolve their expectation
  drift separately; the complete selection is not green.
- New Python syntax, manifest structure and `git diff --check` passed. Application
  code, settings, task logic and schedules were unchanged. Real email, uploads,
  OAuth, Maps and paid AI responses remain unverified; tests use mocks.

Provider references: [Resend test sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[Google Maps key restrictions](https://developers.google.com/maps/api-security-best-practices).
