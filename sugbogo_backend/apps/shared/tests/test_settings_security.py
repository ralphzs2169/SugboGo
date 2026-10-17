import os
import runpy
import sys
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase
from rest_framework.permissions import AllowAny

from scripts.audit_view_permissions import api_views, has_explicit_permissions


class ExplicitViewPermissionTests(SimpleTestCase):
    def test_audit_rejects_generated_function_defaults(self):
        from rest_framework.decorators import api_view, permission_classes
        from rest_framework.views import APIView

        @api_view(["GET"])
        def implicit(request):
            pass

        @api_view(["GET"])
        @permission_classes([AllowAny])
        def explicit(request):
            pass

        class ProtectedBase(APIView):
            permission_classes = (AllowAny,)

        class Inherited(ProtectedBase):
            pass

        self.assertFalse(has_explicit_permissions(APIView))
        self.assertFalse(has_explicit_permissions(implicit.cls))
        self.assertTrue(has_explicit_permissions(explicit.cls))
        self.assertTrue(has_explicit_permissions(Inherited))

    def test_every_api_view_declares_permissions(self):
        missing = [
            f"{route}: {view.__module__}.{view.__name__}"
            for route, view in api_views() if not has_explicit_permissions(view)
        ]
        self.assertEqual(missing, [])

    def test_taxonomy_options_remain_public(self):
        from apps.merchant_application.views.category_options_views import CategoryOptionsView
        from apps.merchant_application.views.cluster_options_views import ClusterOptionsView
        from apps.merchant_application.views.tag_options_views import SpecialtyTagOptionsView

        for view in (CategoryOptionsView, ClusterOptionsView, SpecialtyTagOptionsView):
            with self.subTest(view=view.__name__):
                self.assertEqual(view.permission_classes, (AllowAny,))


class SecuritySettingsTests(SimpleTestCase):
    def load_settings(self, env=None, *, testing=False):
        with patch.dict(os.environ, env or {}, clear=True), patch("dotenv.load_dotenv"), patch.object(
            sys, "argv", ["manage.py", "test" if testing else "runserver"],
        ):
            return runpy.run_path(str(Path(settings.BASE_DIR) / "config/settings.py"))

    def test_unset_environment_is_safe_for_ci(self):
        config = self.load_settings()
        self.assertFalse(config["IS_PRODUCTION"])
        self.assertFalse(config.get("SECURE_SSL_REDIRECT", False))
        self.assertEqual(config["CACHES"]["default"]["BACKEND"], "django.core.cache.backends.locmem.LocMemCache")
        self.assertEqual(config["TIME_ZONE"], "UTC")
        self.assertTrue(config["USE_TZ"])

    def test_production_requires_secret_and_rejects_debug(self):
        for env in (
            {"ENVIRONMENT": "production"},
            {"ENVIRONMENT": "production", "SECRET_KEY": " "},
            {"ENVIRONMENT": "production", "SECRET_KEY": "test-secret", "DEBUG": "True"},
        ):
            with self.subTest(env=env), self.assertRaises(ImproperlyConfigured):
                self.load_settings(env)

    def test_production_enables_https_and_shared_cache(self):
        config = self.load_settings({"ENVIRONMENT": "production", "SECRET_KEY": "test-secret"})
        self.assertTrue(config["SECURE_SSL_REDIRECT"])
        self.assertEqual(config["SECURE_PROXY_SSL_HEADER"], ("HTTP_X_FORWARDED_PROTO", "https"))
        self.assertEqual(config["SECURE_HSTS_SECONDS"], 3600)
        self.assertTrue(config["SESSION_COOKIE_SECURE"])
        self.assertTrue(config["CSRF_COOKIE_SECURE"])
        self.assertTrue(config["SECURE_CONTENT_TYPE_NOSNIFF"])
        self.assertEqual(config["X_FRAME_OPTIONS"], "DENY")
        self.assertEqual(config["CACHES"]["default"]["LOCATION"], "redis://127.0.0.1:6379/2")
        self.assertEqual(config["REST_FRAMEWORK"]["DEFAULT_PERMISSION_CLASSES"], ("rest_framework.permissions.IsAuthenticated",))
        self.assertEqual(config["DATA_UPLOAD_MAX_MEMORY_SIZE"], 10 * 1024 * 1024)
        self.assertEqual(config["FILE_UPLOAD_MAX_MEMORY_SIZE"], 10 * 1024 * 1024)

    def test_env_lists_and_ssl_toggle(self):
        config = self.load_settings({
            "ENVIRONMENT": "production", "SECRET_KEY": "test-secret", "SECURE_SSL_REDIRECT": "False",
            "ALLOWED_HOSTS": "api.example.com, localhost, ",
            "CORS_ALLOWED_ORIGINS": "https://admin.example.com, https://other.example.com",
            "CSRF_TRUSTED_ORIGINS": "https://admin.example.com, ",
        })
        self.assertEqual(config["ALLOWED_HOSTS"], ["api.example.com", "localhost"])
        self.assertEqual(config["CORS_ALLOWED_ORIGINS"], ["https://admin.example.com", "https://other.example.com"])
        self.assertEqual(config["CSRF_TRUSTED_ORIGINS"], ["https://admin.example.com"])
        self.assertFalse(config["SECURE_SSL_REDIRECT"])

    def test_explicit_redis_url_is_used_outside_production(self):
        config = self.load_settings({"REDIS_CACHE_URL": "redis://cache:6379/2"})
        self.assertEqual(config["CACHES"]["default"]["LOCATION"], "redis://cache:6379/2")

    def test_tests_always_use_local_cache(self):
        config = self.load_settings({
            "ENVIRONMENT": "production", "SECRET_KEY": "test-secret", "REDIS_CACHE_URL": "redis://shared:6379/2",
        }, testing=True)
        self.assertEqual(config["CACHES"]["default"]["BACKEND"], "django.core.cache.backends.locmem.LocMemCache")

    def test_django_admin_is_disabled_without_debug(self):
        with self.settings(DEBUG=False):
            config = runpy.run_path(str(Path(settings.BASE_DIR) / "config/urls.py"))
        self.assertNotIn("admin/", [str(pattern.pattern) for pattern in config["urlpatterns"]])


    def test_redis_cache_cannot_share_task_or_channel_database(self):
        for variable in ("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", "NOTIFICATION_REDIS_URL"):
            with self.subTest(variable=variable), self.assertRaises(ImproperlyConfigured):
                self.load_settings({"REDIS_CACHE_URL": "redis://cache:6379/2", variable: "redis://cache:6379/2"})
