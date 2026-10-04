from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.notifications.models import Notification
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.tests.fixtures import NotificationFixtures
from apps.users.models import User


class NotificationViewTests(NotificationFixtures, TestCase):
    def setUp(self):
        """Configure an API client using the actual JWT authentication pipeline."""
        super().setUp()
        self.client = APIClient()
        self.authenticate(self.user)
        self.list_url = reverse("notification-list")
        self.count_url = reverse("notification-unread-count")
        self.all_url = reverse("notification-read-all")

    def authenticate(self, user):
        """Set a signed JWT for the recipient."""
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}",
        )

    def test_list_pagination_filter_and_private_field_exclusion(self):
        read = self.create_notification(key="read")
        NotificationService.mark_read(self.user, read.pk)
        unread = self.create_notification(key="unread")
        self.create_notification(self.other)
        response = self.client.get(self.list_url, {"is_read": "false", "page_size": 1})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        data = response.data["data"]
        self.assertEqual(data["pagination"]["total_items"], 1)
        self.assertEqual(data["items"][0]["id"], unread.pk)
        self.assertFalse(data["items"][0]["is_read"])
        self.assertIsNone(data["items"][0]["read_at"])
        self.assertNotIn("USER_ID", str(data))
        self.assertNotIn("dedup_key", str(data))
        self.assertNotIn(self.user.USER_EMAIL, str(data))
        read_response = self.client.get(self.list_url, {"is_read": "true"})
        self.assertEqual(read_response.data["data"]["items"][0]["id"], read.pk)
        self.assertEqual(self.client.get(self.list_url).data["data"]["pagination"]["total_items"], 2)

    def test_pagination_does_not_repeat_items(self):
        first = self.create_notification(key="first")
        second = self.create_notification(key="second")
        page_one = self.client.get(self.list_url, {"page_size": 1, "page": 1})
        page_two = self.client.get(self.list_url, {"page_size": 1, "page": 2})
        self.assertEqual(page_one.data["data"]["items"][0]["id"], second.pk)
        self.assertEqual(page_two.data["data"]["items"][0]["id"], first.pk)

    def test_invalid_filter_returns_validation_envelope(self):
        response = self.client.get(self.list_url, {"is_read": "invalid"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("is_read", response.data["errors"])

    def test_read_and_bulk_operations_preserve_recipient_boundary(self):
        own = self.create_notification()
        other = self.create_notification(self.other)
        self.assertEqual(self.client.get(self.count_url).data["data"]["unread_count"], 1)
        response = self.client.post(reverse("notification-read", args=[own.pk]))
        self.assertEqual(response.status_code, 200)
        timestamp = response.data["data"]["read_at"]
        repeat = self.client.post(reverse("notification-read", args=[own.pk]))
        self.assertEqual(repeat.data["data"]["read_at"], timestamp)
        self.assertEqual(self.client.get(self.count_url).data["data"]["unread_count"], 0)
        self.create_notification(key="new")
        bulk = self.client.post(self.all_url, {"user_id": self.other.pk}, format="json")
        self.assertEqual(bulk.data["data"]["updated_count"], 1)
        self.assertEqual(self.client.post(self.all_url).data["data"]["updated_count"], 0)
        other.refresh_from_db()
        self.assertIsNone(other.NOTF_READ_AT)

    def test_other_recipient_and_missing_item_both_return_404(self):
        other = self.create_notification(self.other)
        for notification_id in (other.pk, 999999):
            response = self.client.post(reverse("notification-read", args=[notification_id]))
            self.assertEqual(response.status_code, 404)
            self.assertFalse(response.data["success"])
        other.refresh_from_db()
        self.assertIsNone(other.NOTF_READ_AT)

    def test_anonymous_cannot_access_any_inbox_operation(self):
        notification = self.create_notification()
        self.client.credentials()
        for method, url in (
            ("get", self.list_url), ("get", self.count_url),
            ("post", self.all_url),
            ("post", reverse("notification-read", args=[notification.pk])),
        ):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401)

    def test_existing_token_is_rejected_after_disable(self):
        notification = self.create_notification()
        self.user.USER_STATUS = User.UserStatus.DISABLED
        self.user.save(update_fields=["USER_STATUS"])
        for method, url in (
            ("get", self.list_url), ("get", self.count_url),
            ("post", self.all_url),
            ("post", reverse("notification-read", args=[notification.pk])),
        ):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401)
        notification.refresh_from_db()
        self.assertIsNone(notification.NOTF_READ_AT)

    def test_all_application_roles_have_only_their_own_inbox(self):
        self.create_notification()
        for role in User.UserRole.values:
            with self.subTest(role=role):
                recipient = self.make_user(role, role)
                own = self.create_notification(recipient)
                self.authenticate(recipient)
                response = self.client.get(self.list_url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual([item["id"] for item in response.data["data"]["items"]], [own.pk])

    def test_client_cannot_create_notifications(self):
        response = self.client.post(self.list_url, {
            "recipient": self.other.pk, "title": "Fake official notification",
        }, format="json")
        self.assertEqual(response.status_code, 405)
        self.assertFalse(Notification.objects.exists())

    def test_read_payload_cannot_change_content_or_recipient(self):
        own = self.create_notification()
        response = self.client.post(reverse("notification-read", args=[own.pk]), {
            "title": "Replacement", "USER_ID": self.other.pk, "read_at": None,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        own.refresh_from_db()
        self.assertEqual(own.USER_ID_id, self.user.pk)
        self.assertEqual(own.NOTF_TITLE, "Review inspected")
        self.assertIsNotNone(own.NOTF_READ_AT)

    def test_empty_inbox_has_zero_count_and_empty_page(self):
        self.assertEqual(self.client.get(self.count_url).data["data"]["unread_count"], 0)
        self.assertEqual(self.client.get(self.list_url).data["data"]["items"], [])
        self.assertEqual(self.client.post(self.all_url).data["data"]["updated_count"], 0)

