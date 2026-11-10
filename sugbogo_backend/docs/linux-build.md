# Linux build and ASGI startup

## Scope and runtime

Run all commands from `sugbogo_backend`, the Docker build context. The image's
working directory is `/app`. This build starts only the API, not migrations,
Celery, Redis or a database. It preserves `config.asgi:application`, Channels and
`/ws/notifications/`.

The target is **Linux amd64, CPython 3.12.16, Debian 12 (Bookworm)**. The Dockerfile
pins the official Python image by patch version and digest. Python 3.12 matches
the existing local environment's minor version, satisfies Django 6's minimum,
and has a wheel for the pinned CPU PyTorch package. It avoids an unnecessary
Python minor-version migration. Existing Windows Python 3.12 development remains
supported; do not reuse its virtual environment inside Linux.

The Python dependency lock targets this Linux/Python combination. ARM hosts can
build with amd64 emulation, but native ARM dependency resolution is not certified.
Do not remove the architecture check without regenerating and testing the lock.

## Native dependencies

| Stage | Debian packages | Reason |
| --- | --- | --- |
| Builder | `g++` and its package dependencies | Compile fastText's C++ extension; Python headers come from the Python image. |
| Runtime | `libgdal32` | GDAL 3.6; loads through GeoDjango's ctypes interface. |
| Runtime | `libgeos-c1v5` | GEOS 3.11 C interface for geometry operations. |
| Runtime | `libproj25` and its data dependencies | PROJ 9.1 coordinate transformations. |
| Runtime | `libgomp1` | OpenMP runtime needed by CPU ML libraries. |
| Runtime | `ca-certificates` | Verify HTTPS provider/package connections. |

Bookworm's GDAL package also depends on `libpq5`. The pinned `psycopg-binary`
package bundles its own libpq, so this application does not need `libpq-dev`,
PostgreSQL command-line tools or a PostgreSQL server inside the API image.
GeoDjango does not need a separate pip-installed `GDAL` package here. Windows
`GDAL_LIBRARY_PATH` and `GEOS_LIBRARY_PATH` values are not used on Linux.

The final stage contains no C++ compiler. It runs as an unprivileged user.

## Dependency installation

`requirements.txt` remains the existing cross-platform list of direct pins.
`requirements-linux.lock` locks their Linux transitive dependency versions.
`requirements-build.txt` pins the tooling needed to build fastText.

The build installs the version lock with `--no-build-isolation`:

- fastText 0.9.3 has no compatible Linux wheel; it builds using the pinned
  setuptools, wheel, pybind11 and NumPy packages in the builder virtualenv.
  Keep the setuptools pin: fastText still uses legacy setup metadata.
- PyTorch remains `2.14.0+cpu`. Only its official CPU wheel listing is added via
  `--find-links`; other packages use PyPI. No CUDA toolkit is installed.
- Transformers, Hugging Face Hub and all existing sentiment dependencies remain
  included. `pip check` rejects an inconsistent installed dependency graph.

No model artifacts are downloaded. Sentiment still requires separately
provisioned files referenced by `FASTTEXT_LID_MODEL_PATH` and
`TAGALOG_SENTIMENT_MODEL_PATH`. Library imports are checked during the build;
inference and model availability are separate acceptance gates.

To update the lock intentionally, use the selected Linux Python environment,
install `g++`, create a disposable virtualenv, and run:

```sh
python -m pip install pip-tools==7.6.2 -r requirements-build.txt
pip-compile requirements.txt \
    --constraint requirements-build.txt \
    --find-links https://download.pytorch.org/whl/cpu/torch/ \
    --no-build-isolation \
    --allow-unsafe \
    --no-strip-extras \
    --output-file requirements-linux.lock
```

Review the resulting diff and rebuild. Do not generate the Linux lock by freezing
the Windows virtualenv. The base image and Python application dependencies are
pinned; Debian security packages still come from current Bookworm repositories.
Artifact hashes are not locked. This is a repeatable version-pinned installation
approach, not a byte-identical OS/package snapshot.

## Build and run

```sh
docker build --platform linux/amd64 --tag sugbogo-api:local .
```

`.dockerignore` uses a source allowlist and excludes nested `.env` files, logs,
bytecode, model weights and key files. Local virtualenvs, demo journals and Beat
state are outside that allowlist. The Dockerfile copies only application source
and build inputs. Never pass credentials as Docker build arguments or bake them
into image layers.

Inject the Task 2A production environment at runtime through the hosting service
or a protected environment file outside the build context. For a local container
smoke test using such a file:

```sh
docker run --rm \
    --env-file /secure/path/backend.env \
    --env PORT=8000 \
    --publish 127.0.0.1:8000:8000 \
    sugbogo-api:local
```

The default command is `python scripts/start_api.py`. It validates `PORT`
(default 8000, range 1–65535), binds to `0.0.0.0`, and replaces itself with:

```sh
python -m daphne -b 0.0.0.0 -p "${PORT:-8000}" \
    --websocket-max-message-size 8192 config.asgi:application
```

The launcher performs no shell evaluation and forwards termination signals by
replacing the API process. `EXPOSE 8000` is documentation; it does not override a
hosting provider's `PORT` or publish ports automatically. Hosts without Docker
can use the same launcher after reproducing these dependencies.

Release migrations must be a separate, controlled operation. Independent worker
and Beat startup, state storage and database configuration are documented in
[Database and background services](cloud-services.md). No services are started
by the image build.

## Checks and deployment prerequisites

Run Django's checks with runtime configuration injected, without starting the API:

```sh
docker run --rm --env-file /secure/path/backend.env \
    sugbogo-api:local python manage.py check
docker run --rm --env-file /secure/path/backend.env \
    sugbogo-api:local python manage.py check --deploy
```

Still required before hosting: PostGIS database and migrations, Redis for real
notification delivery, external integration variables, HTTPS/proxy verification,
WebSocket upgrade support, static-file serving and separately provisioned model
files. A successful import/build does not establish that those services work.

Use CPU-only packages and measure image size, model-loading memory, inference
latency and cold starts before choosing a $20–$40 hosting plan. Building fastText
uses more memory than the idle API. Multiple processes loading models can each
retain a separate copy. No GPU or additional orchestration is required by this
build.

## Validation record (2026-11-10)

The local Docker Linux/amd64 build succeeded with the full dependency lock,
including compiling fastText. `pip check` and the build-time GIS/CPU ML imports
passed. The final image runs as `sugbogo`; no `.env` files, model weights or C++
compiler were present in the inspected runtime.

With generated test configuration and external networking disabled:

- GDAL 3.6.2 and GEOS 3.11.1 loaded; a coordinate transformation succeeded.
- The existing ASGI application imported and Django's system check passed.
- All 14 focused startup/security tests passed on Linux (also passed on Windows).
- WebSocket routing, malformed-frame rejection and the origin guard passed using
  an in-memory channel layer. This does not certify real Redis delivery.
- The actual launcher bound Daphne to `0.0.0.0:9123`, returned the expected HTTP
  401 for the protected notification API, and exited cleanly on SIGTERM.

Wait for the TCP listener before HTTP smoke tests; the initial one-second probe
was too short for request initialization. No authenticated database workflows,
TLS proxy, real Redis delivery or model inference were validated in this task.

## References

- [Django 6 Python compatibility](https://docs.djangoproject.com/en/6.0/faq/install/)
- [GeoDjango native libraries](https://docs.djangoproject.com/en/6.0/ref/contrib/gis/install/geolibs/)
- [Official Python image](https://hub.docker.com/_/python)
- [fastText 0.9.3 distribution](https://pypi.org/project/fasttext/0.9.3/)
- [Official PyTorch CPU wheel listing](https://download.pytorch.org/whl/cpu/torch/)
