from rest_framework_simplejwt.views import TokenRefreshView

# This view is used to refresh the access token.
token_refresh_view = TokenRefreshView.as_view()