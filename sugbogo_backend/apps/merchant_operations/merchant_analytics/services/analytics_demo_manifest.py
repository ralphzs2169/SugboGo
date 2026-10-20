"""Persist signed, atomic execution journals independently of database transactions."""

import hashlib
import json
import os
import tempfile
from pathlib import Path

from django.core import signing
from django.core.serializers.json import DjangoJSONEncoder
from rest_framework.exceptions import ValidationError


SALT = "sugbogo.merchant-analytics-demo.v1"


def canonical(value):
    """Serialize fixture identities deterministically without passwords or connection secrets."""
    return json.dumps(
        value,
        cls=DjangoJSONEncoder,
        sort_keys=True,
        separators=(",", ":"),
    )


def fingerprint(value):
    """Hash a complete persisted row snapshot for non-destructive ownership verification."""
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def row_snapshot(record):
    """Record field fingerprints rather than storing raw account or review fields in the journal."""
    values = {
        field.attname: getattr(record, field.attname)
        for field in record._meta.concrete_fields
    }
    return {
        "model": record._meta.label_lower,
        "id": record.pk,
        "fingerprint": fingerprint(values),
    }


class AnalyticsDemoManifest:
    """Keep a signed write-ahead journal and retain completed cleanup receipts."""

    def __init__(
        self,
        directory,
        business_id,
    ):
        """Bind one active journal path to the explicitly selected business."""
        self.path = Path(directory).resolve() / f"merchant-{business_id}-v1.json"

    def read(self):
        """Read and authenticate an existing journal without creating files or directories."""
        if not self.path.exists():
            return None
        if self.path.is_symlink():
            raise ValidationError("Refusing a symlinked analytics demo manifest.")
        try:
            wrapper = json.loads(self.path.read_text(encoding="utf-8"))
            data = wrapper["data"]
            signer = signing.Signer(salt=SALT)
            signer.unsign(f"{canonical(data)}{signer.sep}{wrapper['signature']}")
            return data
        except (OSError, ValueError, KeyError, TypeError, signing.BadSignature):
            raise ValidationError(
                "The analytics demo manifest is unreadable or its signature is invalid.",
            ) from None

    def write(
        self,
        data,
    ):
        """Atomically replace and fsync a signed journal before its corresponding database mutation."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        wrapper = {
            "data": data,
            "signature": signing.Signer(salt=SALT).signature(canonical(data)),
        }
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.path.parent,
                delete=False,
            ) as handle:
                temporary = Path(handle.name)
                handle.write(canonical(wrapper))
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(self.path)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()

    def archive(
        self,
        data,
    ):
        """Retain a signed cleanup receipt while allowing an explicit new apply to start fresh."""
        self.write(data)
        receipt = self.path.with_name(
            f"{self.path.stem}.cleaned-{fingerprint(data)[:16]}.json",
        )
        self.path.replace(receipt)
        return str(receipt)
