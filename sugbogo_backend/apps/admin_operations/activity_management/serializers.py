from rest_framework import serializers

from apps.admin_operations.activity_management.models import AdminActivity
from apps.users.models import User


class AdminActivityActorSerializer(serializers.ModelSerializer):
    """Serializes the administrator who performed an audited action."""

    id = serializers.IntegerField(
        source="USER_ID",
        read_only=True,
    )
    name = serializers.CharField(
        source="full_name",
        read_only=True,
    )
    email = serializers.EmailField(
        source="USER_EMAIL",
        read_only=True,
    )
    role = serializers.CharField(
        source="USER_ROLE",
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "name",
            "email",
            "role",
        )


class AdminActivitySerializer(serializers.ModelSerializer):
    """Serializes one administrative action from a user's history."""

    id = serializers.IntegerField(
        source="AACT_ID",
        read_only=True,
    )
    action = serializers.CharField(
        source="AACT_ACTION",
        read_only=True,
    )
    actor = AdminActivityActorSerializer(
        source="ACTOR_ID",
        read_only=True,
    )
    timestamp = serializers.DateTimeField(
        source="AACT_CREATED_AT",
        read_only=True,
    )
    context = serializers.JSONField(
        source="AACT_CONTEXT",
        read_only=True,
    )

    class Meta:
        model = AdminActivity
        fields = (
            "id",
            "action",
            "actor",
            "timestamp",
            "context",
        )
