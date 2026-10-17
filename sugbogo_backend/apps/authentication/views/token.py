from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView

# This view is used to refresh the access token.
class PublicTokenRefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)


token_refresh_view = PublicTokenRefreshView.as_view()