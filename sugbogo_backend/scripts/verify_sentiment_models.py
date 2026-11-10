"""Verify existing model files offline; optionally run two bounded inference checks."""

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import sys
import time

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = Path(__file__).with_name("sentiment_models.json")


def verify_artifacts(
    manifest,
    environment,
):
    """Require readable absolute paths and exact reviewed file sizes and hashes."""
    verified = []
    for artifact in manifest["artifacts"]:
        variable = artifact["variable"]
        value = environment.get(variable)
        if not value:
            raise ValueError(f"Configure {variable} before verifying models.")
        root = Path(value).expanduser()
        if not root.is_absolute():
            raise ValueError(f"{variable} must be an absolute path.")
        relative_path = artifact["relative_path"]
        path = root
        if relative_path is not None:
            path = root / relative_path
        name = relative_path or "lid.176.bin"
        if not path.is_file():
            raise ValueError(f"{variable}: required file {name} is missing.")
        if path.stat().st_size != artifact["size_bytes"]:
            raise ValueError(f"{variable}: {name} does not match the reviewed size.")
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != artifact["sha256"]:
            raise ValueError(f"{variable}: {name} does not match the reviewed SHA-256.")
        verified.append({
            "file": name,
            "size_bytes": artifact["size_bytes"],
        })
    return verified


def memory_snapshot():
    """Report Linux process RSS and peak RSS without adding a monitoring dependency."""
    if not sys.platform.startswith("linux"):
        return {"memory_measurement": "unavailable on this platform"}
    import resource

    for line in Path("/proc/self/status").read_text().splitlines():
        if line.startswith("VmRSS:"):
            rss_kib = int(line.split()[1])
            break
    else:
        rss_kib = 0
    return {
        "rss_mib": round(rss_kib / 1024, 1),
        "peak_rss_mib": round(
            resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
            1,
        ),
    }


def smoke_test(manifest):
    """Load the unchanged pipeline directly to avoid unrelated Django/provider imports."""
    specification = importlib.util.spec_from_file_location(
        "verified_sentiment_pipeline",
        BASE_DIR / "apps" / "reviews" / "services" / "sentiment.py",
    )
    pipeline = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(pipeline)
    if (
        pipeline.TAGALOG_MODEL_ID != manifest["tagalog_model_id"]
        or pipeline.TAGALOG_MODEL_REVISION != manifest["tagalog_revision"]
    ):
        raise ValueError("The model manifest and pipeline revision disagree.")
    print(
        json.dumps({"stage": "before_inference", **memory_snapshot()}),
        flush=True,
    )
    for stage, text, expected_model in (
        (
            "english",
            "I absolutely love this wonderful place. The food and service were excellent.",
            "vader",
        ),
        (
            "tagalog",
            "Napakasarap ng pagkain at napakabait ng mga empleyado.",
            pipeline.TAGALOG_MODEL_ID,
        ),
    ):
        started = time.perf_counter()
        cpu_started = time.process_time()
        score, label, model = pipeline.route_sentiment(text)
        if (
            not math.isfinite(score)
            or not -1 <= score <= 1
            or label not in pipeline.LABELS
            or model != expected_model
        ):
            raise ValueError(f"The {stage} inference smoke check failed.")
        print(
            json.dumps({
                "stage": stage,
                "score": round(score, 6),
                "label": label,
                "model": model,
                "wall_seconds": round(time.perf_counter() - started, 3),
                "cpu_seconds": round(time.process_time() - cpu_started, 3),
                **memory_snapshot(),
            }),
            flush=True,
        )


def main():
    """Verify local inputs without downloads, application startup or credential output."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke-test", action="store_true")
    arguments = parser.parse_args()
    load_dotenv(BASE_DIR / ".env")
    manifest = json.loads(MANIFEST_PATH.read_text())
    try:
        verified = verify_artifacts(manifest, os.environ)
        print(json.dumps({"verified_files": verified}), flush=True)
        if arguments.smoke_test:
            smoke_test(manifest)
    except (ValueError, OSError, RuntimeError) as error:
        # No provider client is initialized; avoid raw loader exception text.
        parser.exit(
            1,
            f"Model verification failed ({type(error).__name__}). "
            "Check configured paths, files, hashes and loader compatibility.\n",
        )


if __name__ == "__main__":
    main()
