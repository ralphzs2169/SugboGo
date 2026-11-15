"""Create one hosted Maya Sandbox checkout with bounded HTTP handling."""

import json
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import urlsplit
from uuid import UUID

import requests
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from requests.auth import HTTPBasicAuth

from config.payments import MAYA_SANDBOX_API_BASE_URL, is_maya_api_key, parse_maya_return_url


class MayaConfigurationError(Exception):
    """Report a failure detected before sending Create Checkout."""


class MayaCreationRejected(Exception):
    """Report a recognizable Maya rejection that permits a later explicit retry."""


class MayaCreationUnknown(Exception):
    """Report an outcome that requires reconciliation before another creation attempt."""


@dataclass(frozen=True)
class MayaCheckout:
    """Carry validated hosted-checkout evidence into the payments domain."""

    checkout_id: str
    checkout_url: str
    status: str


class MayaCheckoutService:
    """Send the documented Create Checkout request to Maya Sandbox."""

    CHECKOUT_URL = f"{MAYA_SANDBOX_API_BASE_URL}/checkout/v1/checkouts"
    HOSTED_CHECKOUT_HOSTS = frozenset({
        "payments-web-sandbox.paymaya.com",
        "payments-web-sandbox.maya.ph",
    })
    CONNECT_TIMEOUT_SECONDS = 3.05
    READ_TIMEOUT_SECONDS = 10
    MAX_RESPONSE_BYTES = 65536
    AUTH_REJECTION_CODES = frozenset({"K001", "K002", "K003", "K004", "K006", "K007"})

    @staticmethod
    def is_checkout_id(value):
        """Require Maya's canonical hyphenated UUID representation."""
        if not isinstance(value, str):
            return False
        try:
            return str(UUID(value)) == value.lower()
        except ValueError:
            return False

    @classmethod
    def is_safe_checkout_url(
        cls,
        value,
    ):
        """Allow only the Maya Sandbox hosted origin and preserve the opaque URL."""
        if (
            not isinstance(value, str)
            or not value
            or len(value) > 2048
            or "\\" in value
            or any(character.isspace() or not character.isprintable() for character in value)
        ):
            return False
        try:
            url = urlsplit(value)
            return (
                url.scheme == "https"
                and url.netloc.lower() in cls.HOSTED_CHECKOUT_HOSTS
                and bool(url.path)
            )
        except ValueError:
            return False

    @staticmethod
    def _checkout_body(
        *,
        operation_reference,
        product_name,
        amount_centavos,
        redirect_urls,
    ):
        """Encode exact decimal pesos as a JSON number and escape all text through JSON."""
        amount = format(Decimal(amount_centavos).scaleb(-2), ".2f")
        item_amount = f'{{"value": {amount}}}'
        return (
            '{'
            f'"totalAmount": {{"value": {amount}, "currency": "PHP"}}, '
            f'"items": [{{"name": {json.dumps(product_name)}, "quantity": 1, '
            f'"amount": {item_amount}, "totalAmount": {item_amount}}}], '
            f'"requestReferenceNumber": {json.dumps(str(operation_reference))}, '
            f'"redirectUrl": {json.dumps(redirect_urls)}'
            '}'
        )

    @classmethod
    def _read_json(
        cls,
        response,
    ):
        """Read a bounded JSON object while retaining no raw provider error details."""
        body = bytearray()
        for chunk in response.iter_content(chunk_size=8192):
            if len(body) + len(chunk) > cls.MAX_RESPONSE_BYTES:
                raise MayaCreationUnknown("provider_response_unusable")
            body.extend(chunk)
        try:
            payload = json.loads(body)
        except (ValueError, RecursionError):
            raise MayaCreationUnknown("provider_response_unusable") from None
        if not isinstance(payload, dict):
            raise MayaCreationUnknown("provider_response_unusable")
        return payload

    @classmethod
    def _raise_creation_failure(
        cls,
        status_code,
        payload,
    ):
        """Recognize documented pre-creation error codes with no checkout evidence."""
        if (
            "checkoutId" not in payload
            and "redirectUrl" not in payload
            and "data" not in payload
            and isinstance(payload.get("message"), str)
        ):
            code = payload.get("code")
            if (
                status_code in {400, 422}
                and code in ("2553", 2553)
            ):
                raise MayaCreationRejected("provider_validation_rejected")
            if (
                status_code in {401, 403}
                and isinstance(code, str)
                and code in cls.AUTH_REJECTION_CODES
            ):
                raise MayaCreationRejected("provider_authentication_rejected")
        raise MayaCreationUnknown("provider_outcome_unknown")

    @classmethod
    def create_checkout(
        cls,
        *,
        mode,
        operation_reference,
        product_name,
        amount_centavos,
        currency,
        success_url,
        failure_url,
        cancel_url,
    ):
        """Create a Sandbox checkout once and return validated checkout evidence."""
        key = settings.MAYA_SANDBOX_PUBLIC_KEY
        if mode != "test" or not is_maya_api_key(key, "pk-"):
            raise MayaConfigurationError("Payment configuration is unavailable.")
        if (
            not isinstance(operation_reference, UUID)
            or not isinstance(product_name, str)
            or not product_name.strip()
            or type(amount_centavos) is not int
            or amount_centavos <= 0
            or currency != "PHP"
        ):
            raise MayaConfigurationError("Payment product configuration is unavailable.")
        redirect_urls = {
            "success": success_url,
            "failure": failure_url,
            "cancel": cancel_url,
        }
        try:
            for url in redirect_urls.values():
                parse_maya_return_url(url, allow_query=True)
        except ImproperlyConfigured:
            raise MayaConfigurationError("Payment return configuration is unavailable.") from None
        body = cls._checkout_body(
            operation_reference=operation_reference,
            product_name=product_name,
            amount_centavos=amount_centavos,
            redirect_urls=redirect_urls,
        )
        try:
            with requests.post(
                cls.CHECKOUT_URL,
                auth=HTTPBasicAuth(key, ""),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                data=body,
                timeout=(cls.CONNECT_TIMEOUT_SECONDS, cls.READ_TIMEOUT_SECONDS),
                verify=True,
                allow_redirects=False,
                stream=True,
            ) as response:
                payload = cls._read_json(response)
                if response.status_code != 200:
                    cls._raise_creation_failure(response.status_code, payload)
        except requests.RequestException:
            raise MayaCreationUnknown("provider_connection_interrupted") from None

        checkout_id = payload.get("checkoutId")
        checkout_url = payload.get("redirectUrl")
        status = payload.get("paymentStatus", payload.get("status", ""))
        if not cls.is_checkout_id(checkout_id):
            raise MayaCreationUnknown("provider_checkout_id_invalid")
        if not cls.is_safe_checkout_url(checkout_url):
            raise MayaCreationUnknown("provider_checkout_url_invalid")
        if (
            "code" in payload
            or not isinstance(status, str)
            or len(status) > 32
            or (status and not status.replace("_", "").isalnum())
            or payload.get("requestReferenceNumber", str(operation_reference)) != str(operation_reference)
        ):
            raise MayaCreationUnknown("provider_response_mismatch")
        return MayaCheckout(
            checkout_id=checkout_id,
            checkout_url=checkout_url,
            status=status,
        )
