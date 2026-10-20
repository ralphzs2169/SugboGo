from rest_framework_simplejwt.views import TokenRefreshView
from apps.authentication.session_serializers import SessionRefreshSerializer


class SessionRefreshView(TokenRefreshView):
    """Exposes bounded refresh rotation with the existing unwrapped token response."""

    serializer_class = SessionRefreshSerializer


token_refresh_view = SessionRefreshView.as_view()
