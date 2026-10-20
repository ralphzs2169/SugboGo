from datetime import timedelta
from ipaddress import ip_address

from django.conf import settings
from django.utils import timezone

from apps.authentication.models import LoginEvent, OAuthAccount
from apps.users.models import User


class LoginHistoryService:
    """Records minimal login metadata and exposes account-owned recent events."""

    @staticmethod
    def cutoff():
        """Returns the configured retention boundary shared by reads and pruning."""
        return timezone.now() - timedelta(days=settings.LOGIN_HISTORY_RETENTION_DAYS)

    @staticmethod
    def metadata(request):
        """Classifies untrusted headers without storing raw text or forwarded IPs."""
        agent = request.META.get("HTTP_USER_AGENT", "")[:1024].lower()
        platform = next(
            (label for marker, label in (
                ("android", "Android"), ("iphone", "iOS"), ("ipad", "iOS"),
                ("windows", "Windows"), ("macintosh", "macOS"), ("linux", "Linux"),
            ) if marker in agent),
            "Unknown",
        )
        client = next(
            (label for marker, label in (
                ("okhttp", "Mobile app"), ("sugbogo", "Mobile app"),
                ("edg/", "Edge"), ("firefox/", "Firefox"),
                ("chrome/", "Chrome"), ("safari/", "Safari"),
            ) if marker in agent),
            "Unknown",
        )
        try:
            address = str(ip_address(request.META.get("REMOTE_ADDR", "")))
        except ValueError:
            address = None
        return {
            "LEVT_IP_ADDRESS": address,
            "LEVT_PLATFORM": platform,
            "LEVT_CLIENT": client,
        }

    @staticmethod
    def record(*, request, method, outcome, user=None):
        """Writes one outcome using server-owned method and outcome values."""
        return LoginEvent.objects.create(
            USER=user,
            LEVT_METHOD=method,
            LEVT_OUTCOME=outcome,
            **LoginHistoryService.metadata(request),
        )

    @staticmethod
    def password_account(email):
        """Associates password attempts by email without retaining unknown emails."""
        if not isinstance(email, str) or len(email) > 254:
            return None
        return User.objects.filter(USER_EMAIL__iexact=email.strip()).first()

    @staticmethod
    def oauth_account(identity):
        """Resolves only a provider-verified identity for a rejected OAuth attempt."""
        linked = OAuthAccount.objects.filter(
            OAUTH_PROVIDER=identity.provider,
            OAUTH_PROVIDER_ID=identity.provider_id,
        ).select_related("USER").first()
        if linked:
            return linked.USER
        return User.objects.filter(USER_EMAIL__iexact=identity.email).first()

    @staticmethod
    def for_user(user):
        """Returns newest-first history scoped to the authenticated account."""
        return LoginEvent.objects.filter(
            USER=user,
            LEVT_CREATED_AT__gte=LoginHistoryService.cutoff(),
        ).order_by("-LEVT_CREATED_AT", "-LEVT_ID")

    @staticmethod
    def prune():
        """Deletes expired events in bounded batches using a fixed cutoff."""
        cutoff = LoginHistoryService.cutoff()
        count = 0
        while True:
            ids = list(
                LoginEvent.objects.filter(LEVT_CREATED_AT__lt=cutoff)
                .order_by("LEVT_CREATED_AT", "LEVT_ID")
                .values_list("pk", flat=True)[:1000]
            )
            if not ids:
                return count
            deleted, _ = LoginEvent.objects.filter(pk__in=ids).delete()
            count += deleted
