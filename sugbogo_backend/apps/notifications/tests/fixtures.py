from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User


class NotificationFixtures:
    """Provide independent users and an internal notification creator."""

    def setUp(self):
        """Create recipients without depending on seeded reputation configuration."""
        super().setUp()
        self.user = self.make_user("recipient")
        self.other = self.make_user("other")

    def make_user(self, name, role=User.UserRole.EXPLORER):
        """Create an active account for inbox tests."""
        return User.objects.create_user(
            email=f"{name}@example.com",
            password=None,
            USER_FNAME=name,
            USER_LNAME="User",
            USER_ROLE=role,
            USER_STATUS=User.UserStatus.ACTIVE,
            USER_REPUTATION=0,
        )

    def create_notification(self, user=None, key="event-1", **overrides):
        """Create a notification through the internal service."""
        values = {
            "recipient": user or self.user,
            "event_type": "review_decision",
            "title": "Review inspected",
            "body": "Your review has been inspected.",
            "dedup_key": key,
        }
        values.update(overrides)
        return NotificationService.create(**values)

