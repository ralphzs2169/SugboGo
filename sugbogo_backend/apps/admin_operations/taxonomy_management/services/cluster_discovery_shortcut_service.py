from django.db import transaction
from django.db.models import Count, Q
from rest_framework.exceptions import NotFound

from apps.business.models import Business, ClusterDiscoveryShortcut


class ClusterDiscoveryShortcutAdminService:
    @staticmethod
    def list_shortcuts(search=None, ordering=None):
        queryset = ClusterDiscoveryShortcut.objects.select_related(
            "CLUS_ID"
        ).annotate(
            business_count=Count(
                "CLUS_ID__categories__businesses",
                filter=Q(
                    CLUS_ID__categories__businesses__BUSN_STATUS=(
                        Business.BusinessStatus.ACTIVE
                    ),
                ),
                distinct=True,
            ),
        )

        if search:
            queryset = queryset.filter(
                Q(CDS_TITLE__icontains=search)
                | Q(CDS_SUBTITLE__icontains=search)
                | Q(CLUS_ID__CLUS_NAME__icontains=search)
            )

        ordering_map = {
            "title": "CDS_TITLE",
            "-title": "-CDS_TITLE",
            "business_count": "business_count",
            "-business_count": "-business_count",
            "created_at": "CDS_CREATED_AT",
            "-created_at": "-CDS_CREATED_AT",
            "updated_at": "CDS_UPDATED_AT",
            "-updated_at": "-CDS_UPDATED_AT",
        }

        return queryset.order_by(
            ordering_map.get(ordering, "CLUS_ID__CLUS_NAME"),
        )

    @staticmethod
    def get_shortcut(shortcut_id):
        try:
            return ClusterDiscoveryShortcut.objects.select_related("CLUS_ID").get(
                CDS_ID=shortcut_id,
            )
        except ClusterDiscoveryShortcut.DoesNotExist:
            raise NotFound("Discovery Shortcut not found.")

    @staticmethod
    @transaction.atomic
    def create_shortcut(validated_data):
        return ClusterDiscoveryShortcut.objects.create(**validated_data)

    @staticmethod
    @transaction.atomic
    def update_shortcut(shortcut, validated_data):
        for field, value in validated_data.items():
            setattr(shortcut, field, value)

        shortcut.save()
        return shortcut

    @staticmethod
    @transaction.atomic
    def delete_shortcut(shortcut):
        shortcut.delete()
