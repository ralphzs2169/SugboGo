"""Exercise settings and HTTP security without databases or provider requests."""

import os
import runpy
from pathlib import Path
from unittest.mock import patch

from corsheaders.middleware import CorsMiddleware
from django.conf import settings
from django.core.exceptions import DisallowedHost, ImproperlyConfigured
from django.core.management.utils import get_random_secret_key
from django.http import HttpResponse
from django.middleware.csrf import CsrfViewMiddleware, get_token
from django.middleware.security import SecurityMiddleware
from django.test import RequestFactory, SimpleTestCase, override_settings


SETTINGS_FILE = Path(__file__).resolve().parents[2] / "config" / "settings.py"


class ProductionSettingsTests(SimpleTestCase):
    """Load isolated environments without reading or changing the real dotenv file."""

    def load_settings(
        self,
        overrides=None,
        remove=(),
    ):
        """Execute the actual settings with dotenv and Cloudinary side effects mocked."""
        environment = {
            "DEBUG": "False",
            "SECRET_KEY": get_random_secret_key(),
            "ALLOWED_HOSTS": "api.example.com",
        }
        if overrides:
            environment.update(overrides)
        for name in remove:
            environment.pop(name, None)

        with (
            patch.dict(os.environ, environment, clear=True),
            patch("dotenv.load_dotenv"),
            patch("cloudinary.config"),
        ):
            return runpy.run_path(str(SETTINGS_FILE))

    def http_settings(
        self,
        configuration,
    ):
        """Select only the configuration consumed by the real HTTP middleware."""
        return {
            name: configuration[name]
            for name in (
                "DEBUG",
                "ALLOWED_HOSTS",
                "CORS_ALLOWED_ORIGINS",
                "CORS_ALLOW_ALL_ORIGINS",
                "CSRF_TRUSTED_ORIGINS",
                "CSRF_COOKIE_SECURE",
                "SESSION_COOKIE_SECURE",
                "SECURE_SSL_REDIRECT",
                "SECURE_PROXY_SSL_HEADER",
                "SECURE_HSTS_SECONDS",
            )
        }

    def test_explicit_development_preserves_http_localhost_and_lan(self):
        """Keep existing local frontend and native-device development working."""
        configuration = self.load_settings(
            {"DEBUG": "True", "SECRET_KEY": "local-test-only"},
            remove=("ALLOWED_HOSTS",),
        )
        self.assertTrue(configuration["DEBUG"])
        self.assertEqual(configuration["CORS_ALLOWED_ORIGINS"], ["http://localhost:5173"])
        self.assertFalse(configuration["SESSION_COOKIE_SECURE"])
        self.assertFalse(configuration["CSRF_COOKIE_SECURE"])
        self.assertFalse(configuration["SECURE_SSL_REDIRECT"])
        self.assertIsNone(configuration["SECURE_PROXY_SSL_HEADER"])
        with override_settings(**self.http_settings(configuration)):
            for hostname in ("localhost", "127.0.0.1", "192.168.1.2"):
                with self.subTest(hostname=hostname):
                    request = RequestFactory().get("/", HTTP_HOST=hostname)
                    self.assertEqual(request.get_host(), hostname)

    def test_debug_is_false_by_default_and_rejects_typos(self):
        """Missing DEBUG selects production and malformed booleans fail startup."""
        configuration = self.load_settings(remove=("DEBUG",))
        self.assertFalse(configuration["DEBUG"])
        for value in ("", "tru", "1"):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ImproperlyConfigured, "DEBUG"):
                    self.load_settings({"DEBUG": value})

    def test_production_rejects_missing_or_insecure_secret_without_echoing_it(self):
        """Reject absent, weak and development secrets before Django startup."""
        with self.assertRaisesRegex(ImproperlyConfigured, "SECRET_KEY"):
            self.load_settings(remove=("SECRET_KEY",))
        for value in (
            "",
            "short-test-secret",
            "x" * 60,
            "django-insecure-" + get_random_secret_key(),
            " " + get_random_secret_key(),
        ):
            with self.subTest(secret_kind="invalid production secret"):
                with self.assertRaises(ImproperlyConfigured) as raised:
                    self.load_settings({"SECRET_KEY": value})
                if value:
                    self.assertNotIn(value, str(raised.exception))

    def test_production_requires_exact_hosts_and_rejects_other_requests(self):
        """Require an explicit allowlist and reject wildcard or URL-shaped entries."""
        with self.assertRaisesRegex(ImproperlyConfigured, "ALLOWED_HOSTS"):
            self.load_settings(remove=("ALLOWED_HOSTS",))
        for value in (
            "",
            "*",
            "api.example.com,*",
            ".example.com",
            "*.example.com",
            "https://api.example.com",
            "api.example.com:8000",
            "api.example.com/path",
        ):
            with self.subTest(hosts=value):
                with self.assertRaisesRegex(ImproperlyConfigured, "ALLOWED_HOSTS"):
                    self.load_settings({"ALLOWED_HOSTS": value})

        configuration = self.load_settings({
            "ALLOWED_HOSTS": " api.example.com, api.internal, [::1] , ",
        })
        self.assertEqual(
            configuration["ALLOWED_HOSTS"],
            ["api.example.com", "api.internal", "[::1]"],
        )
        with override_settings(**self.http_settings(configuration)):
            request = RequestFactory().get("/", HTTP_HOST="api.example.com")
            self.assertEqual(request.get_host(), "api.example.com")
            request = RequestFactory().get("/", HTTP_HOST="unlisted.example.com")
            with self.assertRaises(DisallowedHost):
                request.get_host()

    def test_production_origins_default_to_empty_and_reject_unsafe_values(self):
        """Allow no cross-origin browser access unless exact origins are supplied."""
        configuration = self.load_settings()
        self.assertEqual(configuration["CORS_ALLOWED_ORIGINS"], [])
        self.assertEqual(configuration["CSRF_TRUSTED_ORIGINS"], [])
        self.assertFalse(configuration["CORS_ALLOW_ALL_ORIGINS"])
        for name in ("CORS_ALLOWED_ORIGINS", "CSRF_TRUSTED_ORIGINS"):
            for value in (
                "*",
                "https://*.example.com",
                "http://admin.example.com",
                "https://admin.example.com/",
                "https://admin.example.com/path",
                "https://user:password@admin.example.com",
                "https://admin.example.com?query=value",
                "https://admin.example.com#fragment",
                "https://admin.example.com:invalid",
                "https://.example.com",
                "https://admin.example.com:",
                "https://admin.example.com?",
                "https://admin.example.com\\other",
                "null",
            ):
                with self.subTest(variable=name, origin=value):
                    with self.assertRaisesRegex(ImproperlyConfigured, name):
                        self.load_settings({name: value})

    def test_cors_allows_only_configured_origins_including_preflight(self):
        """Exercise real CORS responses while retaining Authorization support."""
        configuration = self.load_settings({
            "CORS_ALLOWED_ORIGINS": " https://admin.example.com, https://review.example.com:8443 ",
        })
        with override_settings(**self.http_settings(configuration)):
            middleware = CorsMiddleware(lambda request: HttpResponse())
            for origin in (
                "https://admin.example.com",
                "https://review.example.com:8443",
                "https://unlisted.example.com",
            ):
                with self.subTest(origin=origin):
                    request = RequestFactory().options(
                        "/api/auth/login/",
                        HTTP_ORIGIN=origin,
                        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
                        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type",
                    )
                    response = middleware(request)
                    if origin in configuration["CORS_ALLOWED_ORIGINS"]:
                        self.assertEqual(response["access-control-allow-origin"], origin)
                        self.assertIn("authorization", response["access-control-allow-headers"])
                        self.assertNotIn("access-control-allow-credentials", response)
                    else:
                        self.assertNotIn("access-control-allow-origin", response)

                    middleware = CorsMiddleware(
                        SecurityMiddleware(lambda request: HttpResponse()),
                    )
                    request = RequestFactory().get(
                        "/api/",
                        HTTP_HOST="api.example.com",
                        HTTP_ORIGIN=origin,
                    )
                    response = middleware(request)
                    self.assertEqual(response.status_code, 301)
                    if origin in configuration["CORS_ALLOWED_ORIGINS"]:
                        self.assertEqual(response["access-control-allow-origin"], origin)
                    else:
                        self.assertNotIn("access-control-allow-origin", response)

    def test_csrf_trust_is_separate_and_still_requires_a_token(self):
        """Trusted origins permit valid CSRF proof without disabling protection."""
        configuration = self.load_settings({
            "CSRF_TRUSTED_ORIGINS": " https://forms.example.com, https://forms.example.com:8443 ",
        })
        self.assertEqual(
            configuration["CSRF_TRUSTED_ORIGINS"],
            ["https://forms.example.com", "https://forms.example.com:8443"],
        )
        self.assertEqual(configuration["CORS_ALLOWED_ORIGINS"], [])
        with override_settings(**self.http_settings(configuration)):
            view = lambda request: HttpResponse()
            middleware = CsrfViewMiddleware(view)
            for origin in (
                "https://forms.example.com",
                "https://unlisted.example.com",
            ):
                with self.subTest(origin=origin):
                    request = RequestFactory().post(
                        "/form/",
                        secure=True,
                        HTTP_HOST="api.example.com",
                        HTTP_ORIGIN=origin,
                    )
                    token = get_token(request)
                    request.COOKIES[settings.CSRF_COOKIE_NAME] = request.META["CSRF_COOKIE"]
                    request.META["HTTP_X_CSRFTOKEN"] = token
                    middleware.process_request(request)
                    response = middleware.process_view(request, view, (), {})
                    if origin == "https://forms.example.com":
                        self.assertIsNone(response)
                    else:
                        self.assertEqual(response.status_code, 403)
            request = RequestFactory().post(
                "/form/",
                secure=True,
                HTTP_HOST="api.example.com",
                HTTP_ORIGIN="https://forms.example.com",
            )
            middleware.process_request(request)
            response = middleware.process_view(request, view, (), {})
            self.assertEqual(response.status_code, 403)

    def test_production_cookies_and_direct_https_defaults(self):
        """Secure cookies and HTTPS redirects require no assumed proxy topology."""
        configuration = self.load_settings()
        self.assertTrue(configuration["SESSION_COOKIE_SECURE"])
        self.assertTrue(configuration["CSRF_COOKIE_SECURE"])
        self.assertTrue(configuration["SECURE_SSL_REDIRECT"])
        self.assertIsNone(configuration["SECURE_PROXY_SSL_HEADER"])
        self.assertEqual(configuration["SECURE_HSTS_SECONDS"], 0)
        with override_settings(**self.http_settings(configuration)):
            middleware = SecurityMiddleware(lambda request: HttpResponse())
            insecure = RequestFactory().get(
                "/",
                HTTP_HOST="api.example.com",
                HTTP_X_FORWARDED_PROTO="https",
            )
            self.assertFalse(insecure.is_secure())
            self.assertEqual(middleware(insecure).status_code, 301)
            secure = RequestFactory().get("/", secure=True, HTTP_HOST="api.example.com")
            self.assertEqual(middleware(secure).status_code, 200)

    def test_explicit_proxy_configuration_prevents_https_redirect_loop(self):
        """Only an explicitly trusted header identifies proxy-terminated HTTPS."""
        configuration = self.load_settings({
            "SECURE_PROXY_SSL_HEADER": " HTTP_X_FORWARDED_PROTO, https ",
            "SECURE_HSTS_SECONDS": "300",
        })
        with override_settings(**self.http_settings(configuration)):
            middleware = SecurityMiddleware(lambda request: HttpResponse())
            request = RequestFactory().get(
                "/",
                HTTP_HOST="api.example.com",
                HTTP_X_FORWARDED_PROTO="https",
            )
            self.assertTrue(request.is_secure())
            response = middleware(request)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Strict-Transport-Security"], "max-age=300")
            request = RequestFactory().get(
                "/",
                HTTP_HOST="api.example.com",
                HTTP_X_FORWARDED_PROTO="http",
            )
            self.assertEqual(middleware(request).status_code, 301)

    def test_edge_redirect_override_keeps_production_cookies_secure(self):
        """Permit edge-enforced redirects without weakening cookie flags."""
        configuration = self.load_settings({"SECURE_SSL_REDIRECT": "False"})
        self.assertFalse(configuration["SECURE_SSL_REDIRECT"])
        self.assertTrue(configuration["SESSION_COOKIE_SECURE"])
        self.assertTrue(configuration["CSRF_COOKIE_SECURE"])

    def test_malformed_https_configuration_fails_startup(self):
        """Reject ambiguous header, redirect and HSTS settings without fallback."""
        for name, value in (
            ("SECURE_SSL_REDIRECT", "yes"),
            ("SECURE_PROXY_SSL_HEADER", "HTTP_X_FORWARDED_PROTO"),
            ("SECURE_PROXY_SSL_HEADER", "X-Forwarded-Proto,https"),
            ("SECURE_PROXY_SSL_HEADER", "HTTP_X_FORWARDED_PROTO,https,extra"),
            ("SECURE_PROXY_SSL_HEADER", "HTTP_X_FORWARDED_PROTO,https,"),
            ("SECURE_PROXY_SSL_HEADER", "HTTP_X_FORWARDED_PROTO,"),
            ("SECURE_HSTS_SECONDS", "-1"),
            ("SECURE_HSTS_SECONDS", "invalid"),
        ):
            with self.subTest(variable=name, value=value):
                with self.assertRaisesRegex(ImproperlyConfigured, name):
                    self.load_settings({name: value})

    def test_middleware_order_and_existing_authentication_remain_unchanged(self):
        """Keep CSRF and JWT behavior while wrapping generated responses in CORS."""
        development = self.load_settings({"DEBUG": "True"})
        production = self.load_settings()
        middleware = production["MIDDLEWARE"]
        self.assertLess(
            middleware.index("corsheaders.middleware.CorsMiddleware"),
            middleware.index("django.middleware.security.SecurityMiddleware"),
        )
        self.assertLess(
            middleware.index("corsheaders.middleware.CorsMiddleware"),
            middleware.index("django.middleware.common.CommonMiddleware"),
        )
        self.assertIn("django.middleware.csrf.CsrfViewMiddleware", middleware)
        self.assertEqual(production["REST_FRAMEWORK"], development["REST_FRAMEWORK"])
        self.assertEqual(production["SIMPLE_JWT"], development["SIMPLE_JWT"])
        self.assertEqual(
            production["REST_FRAMEWORK"]["DEFAULT_AUTHENTICATION_CLASSES"],
            ("rest_framework_simplejwt.authentication.JWTAuthentication",),
        )
        self.assertEqual(production["SIMPLE_JWT"]["AUTH_HEADER_TYPES"], ("Bearer",))
        self.assertEqual(production["CHANNEL_LAYERS"], development["CHANNEL_LAYERS"])
        self.assertEqual(
            production["NOTIFICATION_WS_ALLOWED_ORIGINS"],
            development["NOTIFICATION_WS_ALLOWED_ORIGINS"],
        )
