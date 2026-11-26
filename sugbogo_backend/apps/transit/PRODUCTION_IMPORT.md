# Release-approved transit import (manual operations only)

No release hook invokes this command. Do not run it during deployment. The local
import command and reviewed-only seed service entry point retain their guards.

## Approved source

Inspected file: `C:\Users\Angela\Downloads\unified-candidate-seed.json`

- Dataset: `cebu-phase8-candidate-20261126`
- 37 route codes, 71 directional variants; all 71 remain `needs_review`.
- Raw SHA-256: `8c10e63db9e2bfe27396f7907163339e6e7d71b31a5da35080740531bbebd4ec`

PM release approval is independent of operational/passenger-access verification.
No review flag or existing route record is upgraded. Existing models do not store
all seed provenance/review fields: retain the exact source and import receipt as
release audit artifacts. The receipt includes full source metadata and managed IDs.

## Execution environment (operator must select and verify it)

Use this checkout on a trusted workstation with Python dependencies, GDAL/GEOS
and compatible PostgreSQL `pg_dump`/`pg_restore` clients. No deployment is needed.
Use the actual Railway PostgreSQL TCP-proxy host/port for workstation access;
`*.railway.internal` is private-network-only. `railway run` executes locally,
so it does not make private database DNS reachable.

Configure the existing Django `DB_ENGINE`, `DB_NAME`, `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_SSLMODE` (and `DB_SSLROOTCERT` if appropriate)
for the selected production database in a dedicated operator session.
Keep `DEBUG=False` and valid production `SECRET_KEY`/`ALLOWED_HOSTS` settings.
This project does **not** parse `DATABASE_URL` as its Django database configuration.
Do not edit or commit production secrets. Use an encrypted connection for public access.

Do not run any following step until separately authorized to contact Railway.
The host, port, database and PM approval reference are intentionally not guessed.

## 1. Read-only preview

PowerShell, backend directory (all database variables supplied by the operator):

```powershell
$seed = 'C:\Users\Angela\Downloads\unified-candidate-seed.json'
$seedHash = '8c10e63db9e2bfe27396f7907163339e6e7d71b31a5da35080740531bbebd4ec'
.venv\Scripts\python.exe manage.py import_approved_transit --dataset $seed --dataset-sha256 $seedHash --confirm-database $env:DB_NAME --confirm-host $env:DB_HOST --confirm-port $env:DB_PORT --expected-variants 71 > preview.json
if ($LASTEXITCODE -ne 0) { throw 'Preview failed; do not apply.' }
$preview = Get-Content -Raw preview.json | ConvertFrom-Json
```

Inspect every direction, create/reuse counts, and `plan_sha256`. Resolve conflicts
separately: no automatic rename, replacement, deletion, geometry repair or review
promotion is permitted. No writes or advisory/table locks are taken by preview.
Use a read-only database role for preview when available. Failed preview is a blocker.

## 2. Create and restore-test a full backup

Use a durable, access-restricted backup directory outside the repository. For a
normal full `pg_dump` on the same target, set the matching libpq variables in the
operator session (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`,
`PGSSLMODE`, and where needed `PGSSLROOTCERT`) from the verified Django values.
Then:

```powershell
# Choose an existing, access-restricted durable directory outside the repository.
$backupDirectory = 'C:\SecureBackups\ACTUAL_RELEASE_DIRECTORY'
$archive = Join-Path $backupDirectory 'transit-before.dump'
$manifestPath = Join-Path $backupDirectory 'transit-before.backup.json'
$receiptPath = Join-Path $backupDirectory 'transit-release.receipt.json'
$createdAt = [DateTimeOffset]::UtcNow.ToString('o')
pg_dump --format=custom --file=$archive
if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' }
```

Restore that archive into an **empty disposable PostgreSQL/PostGIS database**, on
a separate restore-test target, using explicitly specified restore credentials:

```text
pg_restore --exit-on-error --no-owner --no-privileges --host RESTORE_TEST_HOST --port RESTORE_TEST_PORT --username RESTORE_TEST_USER --dbname EMPTY_RESTORE_TEST_DATABASE ABSOLUTE_PATH_TO_TRANSIT_BEFORE_DUMP
```

Never use Railway production as the restore target. Verify restored transit counts
and ordered geometries against the source database. Keep the successful restore
log. This restore test is an operator prerequisite, not performed by the importer.
Do not attest success until the restore and inspection actually succeeded.

Beside the archive, write `transit-before.backup.json`:

```powershell
@{
  database = $env:DB_NAME
  host = $env:DB_HOST
  port = $env:DB_PORT
  sha256 = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  created_at = $createdAt
  restore_verified_at = [DateTimeOffset]::UtcNow.ToString('o')
  restore_verified = $true
  verified_by = 'ACTUAL_OPERATOR_NAME_AND_RESTORE_LOG_REFERENCE'
} | ConvertTo-Json | Set-Content -Encoding utf8 $manifestPath
```

The command requires a backup created and restore-tested within 24 hours. It checks
identity, hash, nonempty archive, timestamps and operator attestation, then decodes
the complete archive with `pg_restore --file=-` into a discarded output stream.
Archive decoding verifies readability; it **does not replace the operator restore test**.
The manifest is an operator attestation, not a signed proof of backup provenance.

## 3. Explicit authorized apply

Arrange a short transit-authoring maintenance window: apply takes an advisory lock
and write-conflicting locks on the four transit tables (ordinary reads continue).
Recheck the production target/session and the preview before running:

```powershell
.venv\Scripts\python.exe manage.py import_approved_transit --dataset $seed --dataset-sha256 $seedHash --confirm-database $env:DB_NAME --confirm-host $env:DB_HOST --confirm-port $env:DB_PORT --expected-variants 71 --apply --approval-reference 'ACTUAL_PM_APPROVAL_TICKET' --confirm-plan-sha256 $preview.plan_sha256 --backup-file $archive --backup-manifest $manifestPath --receipt $receiptPath
if ($LASTEXITCODE -ne 0) { throw 'Inspect failure and receipt; do not blindly retry.' }
```

The receipt path and its `.source.json` sibling must not already exist. Conflicts,
changed plans, SQL cancellation and validation failures roll back the insert
transaction. Existing rows are never updated or deleted. PostgreSQL sequence gaps
may remain after rollback. Retain backup, manifest, source, preview and receipt.

If a process dies around COMMIT, a `pending` receipt does not prove rollback. Run a
fresh read-only preview to reconcile IDs before retrying with a new receipt path.
If the command reports that commit succeeded but receipt writing failed, likewise
reconcile with preview; never restore or rerun blindly.

## 4. Verify

Repeat the read-only preview on the same file/target: all 71 directions should now
be reused, with zero planned creates. Verify unrelated counts, then perform approved
application smoke tests. Actual live conflicts and import timing remain unknown
until the operator runs preview. This workflow does not activate graph storage,
regenerate artifacts, or change routing, budgets or production feature flags.
