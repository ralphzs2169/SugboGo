# syntax=docker/dockerfile:1

FROM python:3.12.16-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df AS python-base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

FROM python-base AS builder

ARG TARGETARCH
RUN test "$TARGETARCH" = "amd64"

# fastText has no CPython 3.12 Linux wheel and requires a C++ compiler.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements-build.txt requirements-linux.lock ./

RUN python -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --requirement requirements-build.txt \
    && /opt/venv/bin/python -m pip install \
        --no-build-isolation \
        --find-links https://download.pytorch.org/whl/cpu/torch/ \
        --requirement requirements-linux.lock \
    && /opt/venv/bin/python -m pip check

FROM python-base AS runtime

# Debian's GDAL package also supplies PROJ data and libpq via its dependencies.
# psycopg-binary bundles its own libpq; no PostgreSQL server/client tools needed.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates \
        libgdal32 \
        libgeos-c1v5 \
        libgomp1 \
        libproj25 \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY apps/ ./apps/
COPY config/ ./config/
COPY core/ ./core/
COPY manage.py ./
COPY scripts/start_api.py ./scripts/start_api.py

# Import libraries without reading application settings or requiring credentials.
RUN python - <<'PY'
from django.contrib.gis import gdal, geos
import fasttext
import psycopg
import torch
import transformers

if torch.version.cuda is not None:
    raise RuntimeError("The Linux image requires CPU-only PyTorch.")
print("GIS and CPU ML imports OK")
PY

RUN groupadd --system sugbogo \
    && useradd --system --gid sugbogo --home-dir /app sugbogo

USER sugbogo
EXPOSE 8000
CMD ["python", "scripts/start_api.py"]
