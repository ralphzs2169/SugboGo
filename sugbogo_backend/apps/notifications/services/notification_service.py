from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.notifications.models import Notification


class NotificationService:
    """Provides recipient-scoped inbox operations and internal event creation."""

    @staticmethod
    def create(
        *,
        recipient,
        event_type,
        title,
        body,
        dedup_key,
        target_type="",
        target_id=None,
    ):
        """Create an event once per recipient without replacing existing content."""
        values = {
            "NOTF_TYPE": event_type,
            "NOTF_TITLE": title,
            "NOTF_BODY": body,
            "NOTF_TARGET_TYPE": target_type,
            "NOTF_TARGET_ID": target_id,
        }
        candidate = Notification(
            USER_ID=recipient,
            NOTF_DEDUP_KEY=dedup_key,
            **values,
        )
        try:
            candidate.full_clean(validate_unique=False, validate_constraints=False)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict) from exc
        target_id = candidate.NOTF_TARGET_ID
        if (
            bool(candidate.NOTF_TARGET_TYPE) != (target_id is not None)
            or (target_id is not None and target_id <= 0)
        ):
            raise ValidationError("Provide a target type and positive target ID together.")
        notification, _ = Notification.objects.get_or_create(
            USER_ID=recipient,
            NOTF_DEDUP_KEY=dedup_key,
            defaults=values,
        )
        return notification

    @staticmethod
    def queryset(user, *, is_read=None):
        """Return only the recipient's notifications in stable newest-first order."""
        queryset = Notification.objects.filter(USER_ID=user)
        if is_read is not None:
            queryset = queryset.filter(NOTF_READ_AT__isnull=not is_read)
        return queryset

    @staticmethod
    def unread_count(user):
        """Count unread notifications belonging to the recipient."""
        return NotificationService.queryset(user, is_read=False).count()

    @staticmethod
    def mark_read(user, notification_id):
        """Mark a recipient's item read while preserving its first read timestamp."""
        queryset = NotificationService.queryset(user).filter(pk=notification_id)
        now = timezone.now()
        queryset.filter(NOTF_READ_AT__isnull=True).update(
            NOTF_READ_AT=now,
            NOTF_UPDATED_AT=now,
        )
        try:
            return queryset.get()
        except Notification.DoesNotExist as exc:
            raise NotFound("Notification could not be found.") from exc

    @staticmethod
    def mark_all_read(user):
        """Mark currently unread recipient items read in one database statement."""
        now = timezone.now()
        return NotificationService.queryset(user, is_read=False).update(
            NOTF_READ_AT=now,
            NOTF_UPDATED_AT=now,
        )
