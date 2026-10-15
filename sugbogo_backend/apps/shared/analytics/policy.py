"""Use one lazy, immutable policy snapshot per request or explicitly scoped job."""

from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps

from apps.admin_operations.system_configuration.services.analytics_policy_service import AnalyticsPolicyService

_request_policy = ContextVar("analytics_request_policy", default=None)


@contextmanager
def policy_scope():
    """Share a lazy policy holder with nested calls and reset it when the operation ends."""
    if _request_policy.get() is not None:
        yield
        return
    token = _request_policy.set({"snapshot": None})
    try:
        yield
    finally:
        _request_policy.reset(token)


def current_policy():
    """Read once in a request/job; standalone calls get a fresh authoritative snapshot."""
    holder = _request_policy.get()
    if holder is None:
        return AnalyticsPolicyService.read()
    if holder["snapshot"] is None:
        holder["snapshot"] = AnalyticsPolicyService.read()
    return holder["snapshot"]


def with_policy_snapshot(function):
    """Scope direct service and background calls without persisting process-wide caches."""
    @wraps(function)
    def wrapped(*args, **kwargs):
        """Execute one operation inside a resettable policy snapshot boundary."""
        with policy_scope():
            return function(*args, **kwargs)
    return wrapped


class AnalyticsPolicyMiddleware:
    """Provide a lazy request boundary without querying SQL for unrelated endpoints."""

    def __init__(self, get_response):
        """Retain the next synchronous Django middleware handler."""
        self.get_response = get_response

    def __call__(self, request):
        """Reset policy state after each request, including exceptions."""
        with policy_scope():
            return self.get_response(request)
