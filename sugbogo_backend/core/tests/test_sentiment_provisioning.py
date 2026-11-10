"""Check model provisioning with tiny local fixtures, never production weights."""

import hashlib
import importlib.util
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from scripts import verify_sentiment_models as verification


class SentimentProvisioningTests(TestCase):
    """Keep verification read-only and independent of application/provider startup."""

    def manifest(self):
        """Describe a tiny stand-in artifact without loading an ML library."""
        return {
            "artifacts": [{
                "variable": "FASTTEXT_LID_MODEL_PATH",
                "relative_path": None,
                "size_bytes": 4,
                "sha256": hashlib.sha256(b"test").hexdigest(),
            }],
        }

    def test_readable_absolute_artifact_is_verified_without_modification(self):
        """Validate an exact copy and preserve its contents and modification time."""
        with TemporaryDirectory() as directory:
            path = Path(directory) / "model.bin"
            path.write_bytes(b"test")
            modified = path.stat().st_mtime_ns
            result = verification.verify_artifacts(
                self.manifest(),
                {"FASTTEXT_LID_MODEL_PATH": str(path)},
            )
            self.assertEqual(
                result,
                [{"file": "lid.176.bin", "size_bytes": 4}],
            )
            self.assertEqual(path.read_bytes(), b"test")
            self.assertEqual(path.stat().st_mtime_ns, modified)

    def test_missing_relative_and_corrupted_artifacts_fail(self):
        """Do not silently substitute missing, altered or unprovisioned models."""
        for environment in ({}, {"FASTTEXT_LID_MODEL_PATH": "relative/model.bin"}):
            with self.subTest(environment=environment):
                with self.assertRaises(ValueError):
                    verification.verify_artifacts(
                        self.manifest(),
                        environment,
                    )
        with TemporaryDirectory() as directory:
            path = Path(directory) / "model.bin"
            environment = {"FASTTEXT_LID_MODEL_PATH": str(path)}
            for contents in (None, b"wrong-size", b"evil"):
                with self.subTest(contents=contents):
                    if contents is not None:
                        path.write_bytes(contents)
                    with self.assertRaises(ValueError):
                        verification.verify_artifacts(
                            self.manifest(),
                            environment,
                        )

    def test_directory_bundle_requires_every_manifest_file(self):
        """Require tokenizer/configuration files as well as the model weights."""
        manifest = self.manifest()
        manifest["artifacts"][0]["variable"] = "TAGALOG_SENTIMENT_MODEL_PATH"
        manifest["artifacts"][0]["relative_path"] = "config.json"
        with TemporaryDirectory() as directory:
            environment = {"TAGALOG_SENTIMENT_MODEL_PATH": directory}
            with self.assertRaises(ValueError):
                verification.verify_artifacts(
                    manifest,
                    environment,
                )
            (Path(directory) / "config.json").write_bytes(b"test")
            verified = verification.verify_artifacts(
                manifest,
                environment,
            )
            self.assertEqual(len(verified), 1)

    def test_default_command_verifies_without_inference(self):
        """Keep model loading explicitly opt-in for the provisioning tool."""
        with TemporaryDirectory() as directory:
            root = Path(directory)
            model = root / "model.bin"
            model.write_bytes(b"test")
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps(self.manifest()))
            with (
                patch.object(verification, "MANIFEST_PATH", manifest),
                patch.object(verification, "load_dotenv"),
                patch.object(verification, "smoke_test") as smoke,
                patch.dict(
                    verification.os.environ,
                    {"FASTTEXT_LID_MODEL_PATH": str(model)},
                ),
                patch("sys.argv", ["verify_sentiment_models.py"]),
                patch("sys.stdout", new_callable=io.StringIO),
            ):
                verification.main()
                smoke.assert_not_called()

    def test_original_pipeline_is_lazy_and_rejects_missing_model_paths(self):
        """Exercise the actual loader path checks without importing feature services."""
        specification = importlib.util.spec_from_file_location(
            "sentiment_path_test",
            verification.BASE_DIR / "apps" / "reviews" / "services" / "sentiment.py",
        )
        pipeline = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(pipeline)
        self.assertEqual(pipeline._models, {})
        with patch.dict(pipeline.os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                pipeline._path("FASTTEXT_LID_MODEL_PATH")
        with patch.dict(pipeline.os.environ, {"FASTTEXT_LID_MODEL_PATH": "relative.bin"}):
            with self.assertRaises(RuntimeError):
                pipeline._path("FASTTEXT_LID_MODEL_PATH")
