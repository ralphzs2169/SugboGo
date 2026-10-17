"""Run with: python manage.py shell < scripts/audit_view_permissions.py."""

import inspect

from django.urls import URLResolver, get_resolver
from rest_framework.views import APIView


def api_views(patterns=None, prefix=""):
    if patterns is None:
        patterns = get_resolver().url_patterns
    for pattern in patterns:
        route = prefix + str(pattern.pattern)
        if isinstance(pattern, URLResolver):
            yield from api_views(pattern.url_patterns, route)
        else:
            view = getattr(pattern.callback, "cls", None) or getattr(pattern.callback, "view_class", None)
            if view and issubclass(view, APIView):
                yield route, view


def has_explicit_permissions(view):
    # DRF creates a class attribute even when a function omits @permission_classes.
    for method in view.http_method_names:
        handler = getattr(view, method, None)
        if handler and getattr(handler, "__module__", "") == "rest_framework.decorators":
            original = inspect.getclosurevars(handler).nonlocals.get("func")
            return hasattr(original, "permission_classes") or view.permission_classes is not APIView.permission_classes
    # A protected application base class counts; DRF's global default does not.
    return any(
        cls is not APIView and "permission_classes" in cls.__dict__
        for cls in view.__mro__
    )


if __name__ == "__main__":
    for route, view in api_views():
        if not has_explicit_permissions(view):
            print(f"{route}: {view.__module__}.{view.__name__}")
