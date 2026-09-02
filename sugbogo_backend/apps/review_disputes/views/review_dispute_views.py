from core.pagination import StandardPagination
from core.responses import success_response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.authentication.permissions import HasRole
from apps.review_disputes.serializers.review_dispute_serializers import (
    DisputeEvidenceResponseSerializer,
    MerchantReviewDisputeCreateSerializer,
    MerchantReviewDisputeEvidenceCreateSerializer,
    MerchantReviewDisputeResponseSerializer,
)
from apps.review_disputes.services.review_dispute_service import ReviewDisputeService
from apps.users.models import User


class MerchantReviewDisputeListView(APIView):
    permission_classes = (
        IsAuthenticated,
        HasRole(User.UserRole.MERCHANT),
    )

    def get(self, request):
        disputes = ReviewDisputeService.list_merchant_disputes(request.user)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(disputes, request)
        serializer = MerchantReviewDisputeResponseSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MerchantReviewDisputeCreateView(APIView):
    permission_classes = MerchantReviewDisputeListView.permission_classes

    def post(self, request, review_id):
        serializer = MerchantReviewDisputeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dispute = ReviewDisputeService.create_dispute(
            user=request.user,
            review_id=review_id,
            **serializer.validated_data,
        )
        return success_response(
            data=MerchantReviewDisputeResponseSerializer(dispute).data,
            message="Review dispute submitted successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class MerchantReviewDisputeDetailView(APIView):
    permission_classes = MerchantReviewDisputeListView.permission_classes

    def get(self, request, dispute_id):
        dispute = ReviewDisputeService.get_dispute(request.user, dispute_id)
        return success_response(
            data=MerchantReviewDisputeResponseSerializer(dispute).data,
            message="Review dispute retrieved successfully.",
        )


class MerchantReviewDisputeEvidenceView(APIView):
    permission_classes = MerchantReviewDisputeListView.permission_classes

    def post(self, request, dispute_id):
        serializer = MerchantReviewDisputeEvidenceCreateSerializer(
            data={
                "type": request.data.get("type"),
                "file": request.FILES.get("file"),
            },
        )
        serializer.is_valid(raise_exception=True)
        evidence = ReviewDisputeService.add_evidence(
            user=request.user,
            dispute_id=dispute_id,
            evidence_type=serializer.validated_data["type"],
            file=serializer.validated_data["file"],
        )
        return success_response(
            data=DisputeEvidenceResponseSerializer(evidence).data,
            message="Dispute evidence added successfully.",
            status_code=status.HTTP_201_CREATED,
        )


class MerchantReviewDisputeWithdrawView(APIView):
    permission_classes = MerchantReviewDisputeListView.permission_classes

    def post(self, request, dispute_id):
        dispute = ReviewDisputeService.withdraw_dispute(request.user, dispute_id)
        return success_response(
            data=MerchantReviewDisputeResponseSerializer(dispute).data,
            message="Review dispute withdrawn successfully.",
        )


class MerchantReviewDisputeEvidenceDetailView(APIView):
    permission_classes = MerchantReviewDisputeListView.permission_classes

    def delete(self, request, evidence_id):
        ReviewDisputeService.delete_evidence(request.user, evidence_id)
        return success_response(
            data={"evidence_id": evidence_id},
            message="Dispute evidence deleted successfully.",
        )
