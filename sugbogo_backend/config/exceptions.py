from rest_framework.views import exception_handler
from rest_framework.exceptions import Throttled


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if isinstance(exc, Throttled):
        wait = getattr(exc, "wait", None)

        response.data = {
            "detail": "Too many verification requests.",
            "message": "Please wait before requesting another verification email.",
            "retry_after": wait,
        }

    return response