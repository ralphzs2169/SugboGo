# isort: skip_file
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.admin_operations.business_management.services.manage_application_service import (
    ApplicationService,
)
from apps.merchant_application.models import (
    MerchantApplication,
    MerchantApplicationDocument,
)
from apps.merchant_application.services.document_service import DocumentService
from apps.merchant_application.tests.test_services import (
    MerchantApplicationServiceMixin,
)
from apps.users.models import User
from core.tests.assertions import APIResponseAssertionsMixin


class MerchantApplicationViewTests(
    MerchantApplicationServiceMixin,
    APIResponseAssertionsMixin,
    APITestCase,
):
    """Test administrator-facing merchant application API views."""

    def setUp(self):
        super().setUp()

        self.admin = User.objects.create_user(
            email="admin-business-applications@example.com",
            password="StrongPassword123!",
            USER_FNAME="Admin",
            USER_LNAME="Business Applications",
            USER_ROLE=User.UserRole.ADMIN,
            USER_STATUS=User.UserStatus.ACTIVE,
        )

        self.client.force_authenticate(user=self.admin)

    def _list_url(self):
        return reverse(
            "merchant-application-list",
        )

    def _detail_url(self, application_id):
        return reverse(
            "merchant-application-detail",
            kwargs={
                "application_id": application_id,
            },
        )

    def _statistics_url(self):
        return reverse(
            "merchant-application-statistics",
        )

    def _reject_url(self, application_id):
        return reverse(
            "merchant-application-reject",
            kwargs={
                "application_id": application_id,
            },
        )

    def _approve_url(self, application_id):
        return reverse(
            "merchant-application-approve",
            kwargs={
                "application_id": application_id,
            },
        )

    def _document_preview_url(self, application_id, document_id):
        return reverse(
            "merchant-application-document-preview",
            kwargs={
                "application_id": application_id,
                "document_id": document_id,
            },
        )

    # List

    def test_application_list_returns_paginated_applications(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        response = self.client.get(
            self._list_url(),
        )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertTrue(
            response.data["success"],
        )

        self.assertIn(
            "items",
            response.data["data"],
        )

        self.assertIn(
            "pagination",
            response.data["data"],
        )

        self.assertEqual(
            len(response.data["data"]["items"]),
            1,
        )

        self.assertEqual(
            response.data["data"]["items"][0]["id"],
            application.MAPP_ID,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["page"],
            1,
        )

        self.assertEqual(
            response.data["data"]["pagination"]["total_items"],
            1,
        )

    def test_application_list_passes_search_parameter_to_service(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.list_applications"
        ) as mock_list:
            mock_list.return_value = (
                MerchantApplication.objects.filter(
                    MAPP_ID=application.MAPP_ID,
                )
            )

            response = self.client.get(
                self._list_url(),
                {
                    "search": "Sugbo Bistro",
                },
            )

        self.assertEqual(
            response.status_code,
            200,
        )

        mock_list.assert_called_once_with(
            search="Sugbo Bistro",
            ordering=None,
            status=None,
            queue_status=None,
        )

    def test_application_list_passes_ordering_parameter_to_service(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.list_applications"
        ) as mock_list:
            mock_list.return_value = (
                MerchantApplication.objects.filter(
                    MAPP_ID=application.MAPP_ID,
                )
            )

            response = self.client.get(
                self._list_url(),
                {
                    "ordering": "business_name",
                },
            )

        self.assertEqual(
            response.status_code,
            200,
        )

        mock_list.assert_called_once_with(
            search=None,
            ordering="business_name",
            status=None,
            queue_status=None,
        )

    def test_application_list_passes_status_parameter_to_service(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.list_applications"
        ) as mock_list:
            mock_list.return_value = (
                MerchantApplication.objects.filter(
                    MAPP_ID=application.MAPP_ID,
                )
            )

            response = self.client.get(
                self._list_url(),
                {
                    "status": MerchantApplication.ApplicationStatus.SUBMITTED,
                },
            )

        self.assertEqual(
            response.status_code,
            200,
        )

        mock_list.assert_called_once_with(
            search=None,
            ordering=None,
            status=MerchantApplication.ApplicationStatus.SUBMITTED,
            queue_status=None,
        )

    def test_application_list_passes_queue_status_parameter_to_service(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.list_applications"
        ) as mock_list:
            mock_list.return_value = (
                MerchantApplication.objects.filter(
                    MAPP_ID=application.MAPP_ID,
                )
            )

            response = self.client.get(
                self._list_url(),
                {
                    "queue_status": "overdue",
                },
            )

        self.assertEqual(
            response.status_code,
            200,
        )

        mock_list.assert_called_once_with(
            search=None,
            ordering=None,
            status=None,
            queue_status="overdue",
        )

    # Detail

    def test_application_detail_returns_application(self):
        application = self._build_complete_application()

        response = self.client.get(
            self._detail_url(application.MAPP_ID),
        )

        self.assertSuccessResponse(
            response,
            message="Application retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            application.MAPP_ID,
        )

    def test_application_detail_returns_not_found_for_missing_application(self):
        response = self.client.get(
            self._detail_url(999999),
        )

        self.assertErrorResponse(
            response,
            message="The application could not be found.",
            code="NOT_FOUND",
            status_code=404,
        )

    # Statistics

    def test_application_statistics_returns_statistics(self):
        statistics = {
            "pending_review": 2,
            "approved": 10,
            "rejected": 4,
            "total_applications": 16,
            "approval_rate": 71.4,
            "resubmission_rate": 25.0,
            "sla_compliance_rate": 80.0,
            "approval_rate_trend": {
                "value": 5.2,
                "direction": "up",
                "unit": "percentage_points",
            },
            "resubmission_rate_trend": None,
            "sla_compliance_rate_trend": {
                "value": 10.0,
                "direction": "up",
                "unit": "percentage_points",
            },
            "pending_review_this_week": 3,
            "pending_review_history": [],
            "approval_rate_history": [],
            "resubmission_rate_history": [],
            "sla_compliance_rate_history": [],
            "review_sla_business_days": 5,
            "review_sla_approaching_business_days": 3,
        }

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.MerchantApplicationAnalyticsService.get_application_statistics"
        ) as mock_statistics:
            mock_statistics.return_value = statistics

            response = self.client.get(
                self._statistics_url(),
            )

        self.assertSuccessResponse(
            response,
            message="Application statistics retrieved successfully.",
        )

        self.assertEqual(
            response.data["data"],
            statistics,
        )

        mock_statistics.assert_called_once_with()

    # Reject

    def test_application_reject_returns_success(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        feedback = [
            {
                "section": "identity",
                "message": "Please clarify the registered business name.",
            },
        ]

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.reject_application"
        ) as mock_reject:
            application.MAPP_STATUS = (
                MerchantApplication.ApplicationStatus.REJECTED
            )

            mock_reject.return_value = application

            response = self.client.post(
                self._reject_url(application.MAPP_ID),
                {
                    "feedback": feedback,
                },
                format="json",
            )

        self.assertSuccessResponse(
            response,
            message="Application rejected successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            application.MAPP_ID,
        )

        self.assertEqual(
            response.data["data"]["status"],
            MerchantApplication.ApplicationStatus.REJECTED,
        )

        mock_reject.assert_called_once_with(
            application_id=application.MAPP_ID,
            feedback=feedback,
            reviewer=self.admin,
        )

    def test_application_reject_validates_feedback(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.reject_application"
        ) as mock_reject:
            response = self.client.post(
                self._reject_url(application.MAPP_ID),
                {
                    "feedback": [],
                },
                format="json",
            )

        self.assertEqual(
            response.status_code,
            400,
        )

        mock_reject.assert_not_called()

    # Approve

    def test_application_approve_returns_success(self):
        application = self._build_complete_application()

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.SUBMITTED
        )
        application.save(
            update_fields=["MAPP_STATUS"],
        )

        application.MAPP_STATUS = (
            MerchantApplication.ApplicationStatus.APPROVED
        )

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.ApplicationService.approve_application"
        ) as mock_approve:
            mock_approve.return_value = application

            response = self.client.post(
                self._approve_url(application.MAPP_ID),
                {},
                format="json",
            )

        self.assertSuccessResponse(
            response,
            message="Application approved successfully.",
        )

        self.assertEqual(
            response.data["data"]["id"],
            application.MAPP_ID,
        )

        self.assertEqual(
            response.data["data"]["status"],
            MerchantApplication.ApplicationStatus.APPROVED,
        )

        mock_approve.assert_called_once_with(
            application_id=application.MAPP_ID,
            reviewer=self.admin,
        )

    # Document preview

    def test_document_preview_returns_document_content(self):
        application = self._build_complete_application()

        document = MerchantApplicationDocument.objects.create(
            MAPP_ID=application,
            MDOC_DOCUMENT_TYPE=(
                MerchantApplicationDocument.DocumentType.BUSINESS_REGISTRATION
            ),
            MDOC_DOCUMENT_URL="https://example.com/business-registration.pdf",
            MDOC_DOCUMENT_PUBLIC_ID="business-registration",
            MDOC_CLOUDINARY_VERSION=1,
            MDOC_FILE_NAME="business-registration.pdf",
        )

        document_content = b"%PDF-1.4 test document"

        with patch(
            "apps.admin_operations.business_management.views.manage_application_views.DocumentService.get_document_content"
        ) as mock_content:
            mock_content.return_value = (
                document_content,
                "application/pdf",
            )

            response = self.client.get(
                self._document_preview_url(
                    application.MAPP_ID,
                    document.MDOC_ID,
                ),
            )

        self.assertEqual(
            response.status_code,
            200,
        )

        self.assertEqual(
            response.content,
            document_content,
        )

        self.assertEqual(
            response["Content-Type"],
            "application/pdf",
        )

        mock_content.assert_called_once_with(
            document,
        )

    def test_document_preview_returns_not_found_for_missing_document(self):
        application = self._build_complete_application()

        response = self.client.get(
            self._document_preview_url(
                application.MAPP_ID,
                999999,
            ),
        )

        self.assertErrorResponse(
            response,
            message="The requested document could not be found.",
            code="NOT_FOUND",
            status_code=404,
        )

    # Authentication

    def test_application_list_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self._list_url(),
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_application_detail_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self._detail_url(999999),
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_application_statistics_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self._statistics_url(),
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_application_reject_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self._reject_url(999999),
            {
                "feedback": [],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_application_approve_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            self._approve_url(999999),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    def test_document_preview_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self._document_preview_url(
                999999,
                999999,
            ),
        )

        self.assertEqual(
            response.status_code,
            401,
        )

    # Authorization

    def test_application_list_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self._list_url(),
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_application_detail_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self._detail_url(999999),
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_application_statistics_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self._statistics_url(),
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_application_reject_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self._reject_url(999999),
            {
                "feedback": [],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_application_approve_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            self._approve_url(999999),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            403,
        )

    def test_document_preview_rejects_merchant_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            self._document_preview_url(
                999999,
                999999,
            ),
        )

        self.assertEqual(
            response.status_code,
            403,
        )