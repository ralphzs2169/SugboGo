"""Bounded, non-retrying PayMongo Hosted Checkout v2 transport."""

import json
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

import requests
from django.conf import settings
from requests.auth import HTTPBasicAuth


class PayMongoConfigurationError(Exception):
    """Report unavailable server configuration without exposing its values."""


class PayMongoCreationRejected(Exception):
    """Represent a validated rejection proving checkout creation did not succeed."""


class PayMongoCreationUnknown(Exception):
    """Represent an outcome that must never trigger an automatic creation retry."""


@dataclass(frozen=True)
class PayMongoCheckout:
    """Carry only validated identifiers and safe observations into the domain."""

    session_id: str
    checkout_url: str
    status: str
    intent_id: str = ""
    intent_status: str = ""


class PayMongoService:
    """Construct the single supported provider operation from normalized values."""

    CHECKOUT_URL = "https://api.paymongo.com/v2/checkout_sessions"
    CONNECT_TIMEOUT_SECONDS = 3.05
    READ_TIMEOUT_SECONDS = 10
    MAX_RESPONSE_BYTES = 65536
    SUPPORTED_METHODS = frozenset({"card", "gcash", "paymaya", "qrph"})
    REJECTION_CODES = frozenset({
        "parameter_invalid",
        "parameter_data_type_invalid",
        "parameter_format_invalid",
        "parameter_required",
        "api_key_required",
        "authentication_invalid",
        "api_key_not_found",
        "secret_key_required",
        "account_not_activated",
    })

    @staticmethod
    def secret_for_mode(mode):
        """Select credentials from the stored payment environment, never global mode."""
        if mode not in {"test", "live"}:
            raise PayMongoConfigurationError("Payment configuration is unavailable.")
        key = getattr(settings, f"PAYMONGO_{mode.upper()}_SECRET_KEY", "")
        if not key.startswith(f"sk_{mode}_"):
            raise PayMongoConfigurationError("Payment configuration is unavailable.")
        return key

    @staticmethod
    def is_safe_checkout_url(value):
        """Allow only the documented HTTPS checkout host while retaining opaque tokens."""
        if (
            not isinstance(value, str)
            or not value
            or len(value) > 2048
            or any(character.isspace() for character in value)
            or "\\" in value
        ):
            return False
        try:
            url = urlsplit(value)
            return (
                url.scheme == "https"
                and url.netloc.lower() == "checkout.paymongo.com"
                and bool(url.path)
            )
        except ValueError:
            return False

    @staticmethod
    def validate_return_url(value):
        """Reject unsafe server return targets before transmitting a provider request."""
        try:
            url = urlsplit(value)
            valid = (
                url.scheme == "https"
                and bool(url.hostname)
                and not url.username
                and not url.password
                and not url.fragment
                and not any(character.isspace() for character in value)
                and "\\" not in value
            )
            url.port
        except (TypeError, ValueError):
            valid = False
        if not valid:
            raise PayMongoConfigurationError("Payment return configuration is unavailable.")

    @classmethod
    def _read_json(
        cls,
        response,
    ):
        """Read a bounded decoded response without retaining provider error details."""
        body = bytearray()
        for chunk in response.iter_content(chunk_size=8192):
            body.extend(chunk)
            if len(body) > cls.MAX_RESPONSE_BYTES:
                raise PayMongoCreationUnknown("provider_response_unusable")
        try:
            payload = json.loads(body)
        except (ValueError, UnicodeError, RecursionError):
            raise PayMongoCreationUnknown("provider_response_unusable") from None
        if not isinstance(payload, dict):
            raise PayMongoCreationUnknown("provider_response_unusable")
        return payload

    @classmethod
    def _is_definite_rejection(
        cls,
        status_code,
        payload,
    ):
        """Recognize only allowlisted validation/authentication error envelopes."""
        errors = payload.get("errors")
        return (
            status_code in {400, 401, 403, 422}
            and "data" not in payload
            and isinstance(errors, list)
            and bool(errors)
            and all(
                isinstance(error, dict)
                and isinstance(error.get("code"), str)
                and error["code"] in cls.REJECTION_CODES
                for error in errors
            )
        )

    @classmethod
    def _parse_checkout(
        cls,
        payload,
        *,
        mode,
        attributes,
    ):
        """Accept the documented v2 minimum and validate additional echoes when present."""
        data = payload.get("data")
        if not isinstance(data, dict):
            raise PayMongoCreationUnknown("provider_response_unusable")
        session_id = data.get("id")
        observed = data.get("attributes")
        if (
            data.get("type") != "checkout_session"
            or not isinstance(session_id, str)
            or not re.fullmatch(r"cs_[A-Za-z0-9_]{1,125}", session_id)
            or not isinstance(observed, dict)
            or type(observed.get("livemode")) is not bool
            or observed["livemode"] != (mode == "live")
            or not cls.is_safe_checkout_url(observed.get("checkout_url"))
        ):
            raise PayMongoCreationUnknown("provider_response_mismatch")
        for field in (
            "reference_number", "success_url", "cancel_url", "pass_on_fees",
        ):
            if (
                field in observed
                and observed[field] != attributes[field]
            ):
                raise PayMongoCreationUnknown("provider_response_mismatch")
        if "line_items" in observed:
            items = observed["line_items"]
            expected = attributes["line_items"][0]
            if (
                not isinstance(items, list)
                or len(items) != 1
                or not isinstance(items[0], dict)
                or any(
                    type(items[0].get(field)) is not type(value)
                    or items[0].get(field) != value
                    for field, value in expected.items()
                )
            ):
                raise PayMongoCreationUnknown("provider_response_mismatch")
        if (
            "payment_method_types" in observed
            and observed["payment_method_types"] != attributes["payment_method_types"]
        ):
            raise PayMongoCreationUnknown("provider_response_mismatch")
        status = observed.get("status", "")
        if status not in {"", "active"}:
            raise PayMongoCreationUnknown("provider_response_mismatch")
        intent_id = ""
        intent_status = ""
        intent = observed.get("payment_intent")
        if intent is not None:
            if not isinstance(intent, dict):
                raise PayMongoCreationUnknown("provider_response_mismatch")
            intent_id = intent.get("id")
            intent_attributes = intent.get("attributes")
            if (
                not isinstance(intent_id, str)
                or not re.fullmatch(r"pi_[A-Za-z0-9_]{1,125}", intent_id)
                or not isinstance(intent_attributes, dict)
                or not isinstance(intent_attributes.get("status"), str)
                or len(intent_attributes["status"]) > 40
            ):
                raise PayMongoCreationUnknown("provider_response_mismatch")
            intent_status = intent_attributes["status"]
        return PayMongoCheckout(
            session_id=session_id,
            checkout_url=observed["checkout_url"],
            status=status,
            intent_id=intent_id,
            intent_status=intent_status,
        )

    @classmethod
    def create_checkout_session(
        cls,
        *,
        mode,
        payment_reference,
        operation_reference,
        product_name,
        amount_centavos,
        currency,
        payment_methods,
        success_url,
        cancel_url,
    ):
        """POST once to v2 using Basic secret-key authentication and bounded I/O."""
        secret = cls.secret_for_mode(mode)
        cls.validate_return_url(success_url)
        cls.validate_return_url(cancel_url)
        if (
            type(amount_centavos) is not int
            or amount_centavos <= 0
            or currency != "PHP"
            or not payment_methods
            or len(payment_methods) != len(set(payment_methods))
            or not set(payment_methods).issubset(cls.SUPPORTED_METHODS)
        ):
            raise PayMongoConfigurationError("Payment product configuration is unavailable.")
        attributes = {
            "line_items": [{
                "name": product_name,
                "amount": amount_centavos,
                "currency": currency,
                "quantity": 1,
            }],
            "payment_method_types": list(payment_methods),
            "success_url": success_url,
            "cancel_url": cancel_url,
            "reference_number": str(payment_reference),
            "description": product_name,
            "metadata": {
                "payment_reference": str(payment_reference),
                "operation_reference": str(operation_reference),
            },
            "pass_on_fees": False,
            "send_email_receipt": False,
        }
        try:
            # Requests' default transport has no POST retries; redirects are disabled
            # so neither credentials nor creation can be replayed at another origin.
            with requests.post(
                cls.CHECKOUT_URL,
                auth=HTTPBasicAuth(secret, ""),
                headers={"Accept": "application/json"},
                json={"data": {"attributes": attributes}},
                timeout=(cls.CONNECT_TIMEOUT_SECONDS, cls.READ_TIMEOUT_SECONDS),
                verify=True,
                allow_redirects=False,
                stream=True,
            ) as response:
                payload = cls._read_json(response)
                if response.status_code not in {200, 201}:
                    if cls._is_definite_rejection(
                        response.status_code,
                        payload,
                    ):
                        raise PayMongoCreationRejected("provider_rejected")
                    raise PayMongoCreationUnknown("provider_outcome_unknown")
                return cls._parse_checkout(
                    payload,
                    mode=mode,
                    attributes=attributes,
                )
        except requests.RequestException:
            # Even connection failures are conservative: transmission may have begun.
            raise PayMongoCreationUnknown("provider_connection_interrupted") from None
        except (TypeError, ValueError, KeyError, OverflowError):
            raise PayMongoCreationUnknown("provider_response_unusable") from None
