from unittest.mock import patch

from core.tests.assertions import APIResponseAssertionsMixin
from django.core.cache import cache
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from requests.exceptions import RequestException
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import OAuthAccount
from apps.authentication.services.oauth.base import OAuthUser
from apps.authentication.services.oauth.facebook import FacebookAuthError
from apps.authentication.tokens import password_reset_token_generator
from apps.users.models import User


class FacebookLoginViewTests(
    APIResponseAssertionsMixin,
    APITestCase,
):
    def setUp(self):
        cache.clear()

        self.url = reverse("facebook_login")

        self.oauth_user = OAuthUser(
            provider="facebook",
            provider_id="facebook-123",
            email="john@example.com",
            first_name="John",
            last_name="Doe",
        )
            

    def facebook_login(self, identity=None):
        """Exchange a provider identity through the real authentication endpoint."""
        with patch(
            "apps.authentication.views.facebook_login_view.FacebookOAuthService.verify_access_token",
            return_value=identity or self.oauth_user,
        ):
            return self.client.post(
                self.url,
                {"access_token": "fake-facebook-token"},
                format="json",
            )

    def test_unlinked_facebook_email_cannot_create_a_verified_account(self):
        response = self.facebook_login()
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data["code"], "OAUTH_LINK_REQUIRED")
        self.assertFalse(User.objects.exists())
        self.assertFalse(OAuthAccount.objects.exists())

    @patch(
        "apps.authentication.views.facebook_login_view.FacebookOAuthService.verify_access_token"
    )
    def test_invalid_facebook_token_returns_401(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = FacebookAuthError()

        response = self.client.post(
            self.url,
            {
                "access_token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertErrorResponse(
            response,
            code="INVALID_FACEBOOK_TOKEN",
            message="Invalid Facebook token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    @patch(
        "apps.authentication.views.facebook_login_view.FacebookOAuthService.verify_access_token"
    )
    def test_facebook_service_unavailable_returns_503(
        self,
        mock_verify,
    ):
        mock_verify.side_effect = RequestException()

        response = self.client.post(
            self.url,
            {
                "access_token": "fake-token",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

        self.assertErrorResponse(
            response,
            code="FACEBOOK_SERVICE_UNAVAILABLE",
            message="Unable to verify Facebook token.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    def test_matching_facebook_email_cannot_attach_or_replace_a_subject(self):
        user = User.objects.create_user(
            email=self.oauth_user.email,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        for existing_subject in (None, "different-facebook-subject"):
            with self.subTest(existing_subject=existing_subject):
                if existing_subject is not None:
                    OAuthAccount.objects.create(
                        USER=user,
                        OAUTH_PROVIDER=OAuthAccount.OAuthProvider.FACEBOOK,
                        OAUTH_PROVIDER_ID=existing_subject,
                    )
                response = self.facebook_login()
                self.assertEqual(response.status_code, 403, response.data)
                self.assertEqual(response.data["code"], "OAUTH_LINK_REQUIRED")
                self.assertEqual(
                    OAuthAccount.objects.filter(USER=user, OAUTH_PROVIDER_ID=existing_subject).count(),
                    int(existing_subject is not None),
                )
                self.assertFalse(
                    OAuthAccount.objects.filter(OAUTH_PROVIDER_ID=self.oauth_user.provider_id).exists(),
                )

    def test_linked_facebook_cannot_activate_pending_account(self):
        user = User.objects.create_user(
            email=self.oauth_user.email,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.PENDING,
        )
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER=OAuthAccount.OAuthProvider.FACEBOOK,
            OAUTH_PROVIDER_ID=self.oauth_user.provider_id,
        )

        response = self.facebook_login()
        self.assertEqual(response.status_code, 403, response.data)
        self.assertEqual(response.data["code"], "OAUTH_LINK_REQUIRED")
        user.refresh_from_db()
        self.assertFalse(user.EMAIL_VERIFIED)
        self.assertEqual(user.USER_STATUS, User.UserStatus.PENDING)

    def test_legacy_facebook_link_signs_in_until_mailbox_recovery(self):
        """A previously issued reset proof removes a legacy subject and its sessions."""
        user = User.objects.create_user(
            email=self.oauth_user.email,
            USER_ROLE=User.UserRole.EXPLORER,
            USER_STATUS=User.UserStatus.ACTIVE,
            EMAIL_VERIFIED=True,
        )
        OAuthAccount.objects.create(
            USER=user,
            OAUTH_PROVIDER=OAuthAccount.OAuthProvider.FACEBOOK,
            OAUTH_PROVIDER_ID=self.oauth_user.provider_id,
        )
        first = self.facebook_login()
        self.assertEqual(first.status_code, 200, first.data)
        user.refresh_from_db()
        proof = {
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": password_reset_token_generator.make_token(user),
        }
        replacement = "Mailbox-Recovery-Password-412!"
        reset = self.client.post(
            reverse("reset_password"),
            {
                **proof,
                "password": replacement,
                "confirm_password": replacement,
            },
            format="json",
        )
        self.assertEqual(reset.status_code, 200, reset.data)
        self.assertFalse(OAuthAccount.objects.filter(USER=user).exists())
        rejected = self.facebook_login()
        self.assertEqual(rejected.status_code, 403, rejected.data)
        self.assertEqual(rejected.data["code"], "OAUTH_LINK_REQUIRED")
        self.assertFalse(OAuthAccount.objects.filter(USER=user).exists())

        tokens = first.data["data"]
        expired_access = self.client.get(
            reverse("me"),
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}",
        )
        expired_refresh = self.client.post(
            reverse("token_refresh"),
            {"refresh": tokens["refresh"]},
            format="json",
        )
        self.assertEqual(expired_access.status_code, 401)
        self.assertEqual(expired_refresh.status_code, 401)
        password_login = self.client.post(
            reverse("login"),
            {"email": user.USER_EMAIL, "password": replacement},
            format="json",
        )
        self.assertEqual(password_login.status_code, 200, password_login.data)
