import json
from unittest import TestCase

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from apps.shared.services.maya_webhook_security import InvalidMayaWebhook, verify_maya_webhook


class MayaSigningFixtures:
    now_ms = 1780000000000

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.signing_keys = [
            rsa.generate_private_key(public_exponent=65537, key_size=2048)
            for _ in range(2)
        ]
        cls.verification_keys = tuple(
            key.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("ascii")
            for key in cls.signing_keys
        )

    def signature(self, entries, slot=0):
        nonce = "synthetic-nonce"
        signed = self.signing_keys[slot].sign(
            f"{entries}&nonce={nonce}".encode("utf-8"),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return f"nonce={nonce},v1={signed.hex()}"


class MayaWebhookSignatureTests(MayaSigningFixtures, TestCase):
    payload = {
        "z": None,
        " nested": {"y": [{"number": 0, "empty": ""}, {}, {"b": False}]},
        "emptyArray": [],
        "amount": 1.00,
        "zero": -0.0,
        "small": 1e-7,
        "fixed": 1e-6,
        "large": 1e21,
        "bigFixed": 1e20,
    }
    canonical = (
        " nested.y.0.number=0& nested.y.2.b=false&amount=1&bigFixed=100000000000000000000"
        "&fixed=0.000001&large=1e+21&small=1e-7&zero=0"
    )

    def verify(self, body=None, **overrides):
        params = {
            "timestamp": str(self.now_ms),
            "signature": self.signature(self.canonical),
            "verification_keys": self.verification_keys,
            "now_ms": self.now_ms,
            **overrides,
        }
        if body is None:
            body = json.dumps(self.payload).encode()
        return verify_maya_webhook(body, **params)

    def test_each_rotation_key_and_json_order_verify(self):
        for slot in range(2):
            with self.subTest(slot=slot):
                signature = self.signature(self.canonical, slot)
                body = json.dumps(self.payload, sort_keys=bool(slot)).encode()
                self.assertEqual(self.verify(body, signature=signature)["amount"], 1)

    def test_rejects_missing_malformed_invalid_and_altered_signature(self):
        signature = self.signature(self.canonical)
        for bad_header in (
            "", "broken", "nonce=only", "v1=abcd", "nonce=n,v1=zz",
            "nonce=n,nonce=m,v1=abcd", signature[:-2] + ("00" if not signature.endswith("00") else "ff"),
        ):
            with self.subTest(bad_header=bad_header[:12]):
                with self.assertRaises(InvalidMayaWebhook):
                    self.verify(signature=bad_header)
        with self.assertRaises(InvalidMayaWebhook):
            self.verify(json.dumps({**self.payload, "amount": 2}).encode())

    def test_timestamp_uses_inclusive_five_minute_tolerance(self):
        self.verify(timestamp=str(self.now_ms - 300000))
        self.verify(timestamp=str(self.now_ms + 300000))
        for bad_timestamp in ("", "bad", str(self.now_ms - 300001), str(self.now_ms + 300001)):
            with self.subTest(timestamp=bad_timestamp):
                with self.assertRaises(InvalidMayaWebhook):
                    self.verify(timestamp=bad_timestamp)

    def test_duplicate_json_keys_and_non_json_are_rejected(self):
        for body in (b'{"id":1,"id":1}', b'{"amount":NaN}', b"[]"):
            with self.assertRaises(InvalidMayaWebhook):
                self.verify(body)
