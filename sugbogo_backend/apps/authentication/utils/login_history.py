from functools import wraps

from rest_framework.exceptions import APIException

from apps.authentication.models import LoginEvent
from apps.authentication.services.login_history_service import LoginHistoryService


def track_login_failure(method):
    """Records outcomes after endpoint validation without intercepting throttling."""
    def decorate(view):
        """Wraps one supported sign-in endpoint with failure recording."""
        @wraps(view)
        def tracked(request, *args, **kwargs):
            """Preserves the endpoint response and records rejected attempts once."""
            def record(status_code):
                """Associates only locally known passwords or verified OAuth identities."""
                user = None
                if method in (LoginEvent.Method.PASSWORD, LoginEvent.Method.ADMIN):
                    email = getattr(request, "login_history_email", None)
                    user = LoginHistoryService.password_account(email)
                elif identity := getattr(request, "verified_login_identity", None):
                    user = LoginHistoryService.oauth_account(identity)
                LoginHistoryService.record(
                    request=request, method=method, user=user,
                    outcome=(
                        LoginEvent.Outcome.UNAVAILABLE if status_code >= 500
                        else LoginEvent.Outcome.FAILED
                    ),
                )

            try:
                response = view(request, *args, **kwargs)
            except APIException as exc:
                record(exc.status_code)
                raise
            if response.status_code >= 400:
                record(response.status_code)
            return response
        return tracked
    return decorate
