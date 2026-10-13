from django.test import TestCase

from apps.admin_operations.activity_management.models import AdminActivity
from apps.admin_operations.activity_management.services import (
    AdminActivityService,
)
from apps.users.models import User


class AdminActivityServiceTests(TestCase):
    """Protects direct held-review moderation audit action values."""

    @classmethod
    def setUpTestData(cls):
        """Creates an administrator and review author for audit records."""
        cls.admin = User.objects.create(
            USER_EMAIL="moderation-admin@example.com",
            USER_FNAME="Admin",
            USER_LNAME="Moderator",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )
        cls.author = User.objects.create(
            USER_EMAIL="review-author@example.com",
            USER_FNAME="Review",
            USER_LNAME="Author",
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            password="!",
        )

    def test_direct_review_moderation_actions_are_valid_and_recordable(self):
        """Records distinct approval and rejection actions through the service."""
        actions = (
            (
                AdminActivity.Action.REVIEW_MODERATION_APPROVED,
                "review_moderation_approved",
            ),
            (
                AdminActivity.Action.REVIEW_MODERATION_REJECTED,
                "review_moderation_rejected",
            ),
        )
        valid_choices = dict(
            AdminActivity._meta.get_field("AACT_ACTION").choices,
        )

        for action, expected_value in actions:
            with self.subTest(action=expected_value):
                self.assertEqual(action.value, expected_value)
                self.assertIn(expected_value, valid_choices)

                activity = AdminActivityService.record_user_action(
                    actor=self.admin,
                    target_user=self.author,
                    action=action,
                    context={"review_id": 42},
                )

                activity.full_clean()
                activity.refresh_from_db()
                self.assertEqual(activity.AACT_ACTION, expected_value)
                self.assertEqual(activity.ACTOR_ID, self.admin)
                self.assertEqual(activity.TARGET_USER_ID, self.author)
                self.assertEqual(activity.AACT_CONTEXT, {"review_id": 42})

        self.assertEqual(AdminActivity.objects.count(), 2)
