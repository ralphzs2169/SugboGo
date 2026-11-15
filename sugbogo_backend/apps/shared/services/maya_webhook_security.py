"""Verify Maya Sandbox webhook deliveries using its version-one RSA signature."""

import json
import math
import re
from decimal import Decimal

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

from config.payments import maya_webhook_public_key


MAX_WEBHOOK_BYTES = 65536
TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000


class InvalidMayaWebhook(ValueError):
    """Reject malformed or unauthenticated webhook evidence."""


def _unique_object(pairs):
    """Reject duplicate JSON keys before interpreting signed evidence."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidMayaWebhook()
        result[key] = value
    return result


def _invalid_constant(_value):
    """Reject non-JSON numeric constants."""
    raise InvalidMayaWebhook()


def load_maya_json(body):
    """Decode an unambiguous UTF-8 JSON object, preserving monetary precision."""
    value = json.loads(
        body.decode("utf-8"),
        object_pairs_hook=_unique_object,
        parse_float=Decimal,
        parse_constant=_invalid_constant,
    )
    if not isinstance(value, dict):
        raise InvalidMayaWebhook()
    return value


def _number_string(value):
    """Use JavaScript Number notation for Maya's signed numeric entries."""
    number = float(value)
    if not math.isfinite(number):
        raise InvalidMayaWebhook()
    if number == 0:
        return "0"
    rendered = Decimal(repr(number))
    if 1e-6 <= abs(number) < 1e21:
        fixed = format(rendered, "f")
        if "." in fixed:
            return fixed.rstrip("0").rstrip(".")
        return fixed
    coefficient, exponent = format(rendered, "e").split("e")
    if "." in coefficient:
        coefficient = coefficient.rstrip("0").rstrip(".")
    return f"{coefficient}e{int(exponent):+d}"


def _flatten(
    value,
    prefix="",
):
    """Yield Maya's dot-separated entries, including array indices and false/zero values."""
    if isinstance(value, dict):
        entries = value.items()
    else:
        entries = enumerate(value)
    for key, item in entries:
        if item is None or item == "":
            continue
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(item, (dict, list)):
            yield from _flatten(item, path)
            continue
        if isinstance(item, bool):
            rendered = "true" if item else "false"
        elif isinstance(item, (int, Decimal)):
            rendered = _number_string(item)
        else:
            rendered = item
        yield f"{path}={rendered}"


def verify_maya_webhook(
    body,
    *,
    timestamp,
    signature,
    verification_keys,
    now_ms,
):
    """Authenticate the timestamp and canonical JSON before returning the parsed payload."""
    if (
        not re.fullmatch(r"[0-9]{1,16}", timestamp)
        or abs(now_ms - int(timestamp)) > TIMESTAMP_TOLERANCE_MS
        or len(signature) > 4096
    ):
        raise InvalidMayaWebhook()
    headers = {}
    for part in signature.split(","):
        key, separator, value = part.strip().partition("=")
        if not separator or not key or key in headers:
            raise InvalidMayaWebhook()
        headers[key] = value
    nonce = headers.get("nonce", "")
    signature_hex = headers.get("v1", "")
    if (
        not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", nonce)
        or not re.fullmatch(r"(?:[0-9a-fA-F]{2}){1,1024}", signature_hex)
    ):
        raise InvalidMayaWebhook()
    try:
        payload = load_maya_json(body)
        entries = sorted(
            _flatten(payload),
            key=lambda entry: entry.encode("utf-16-be", errors="surrogatepass"),
        )
        canonical = "&".join(entries) + f"&nonce={nonce}"
        # Node replaces unpaired UTF-16 surrogates when encoding its signing input.
        signed = (
            canonical.encode("utf-16-le", errors="surrogatepass")
            .decode("utf-16-le", errors="replace")
            .encode("utf-8")
        )
    except (ValueError, ArithmeticError, RecursionError):
        raise InvalidMayaWebhook() from None
    signature_bytes = bytes.fromhex(signature_hex)
    for pem in verification_keys:
        key = maya_webhook_public_key(pem)
        try:
            key.verify(
                signature_bytes,
                signed,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
        except InvalidSignature:
            continue
        return payload
    raise InvalidMayaWebhook()
