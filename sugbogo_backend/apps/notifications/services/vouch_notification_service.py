from copy import deepcopy
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.notifications.models import Notification
from apps.notifications.services.notification_realtime_service import (
    NotificationRealtimeService,
)
from apps.notifications.services.notification_service import NotificationService
from apps.users.models import User


class VouchNotificationService:
    """Group one explorer's specialty endorsements without modifying read notices."""

    GROUP_WINDOW = timedelta(minutes=1)
    EVENT_TYPE = "business_vouch_received"

    @staticmethod
    def _body(metadata):
        """Describe distinct specialty snapshots with a bounded list of names."""
        author = metadata["author_name"]
        specialties = metadata["specialties"]
        if len(specialties) == 1:
            name = specialties[0]["name"]
            return f"{author} vouched for your {name} specialty."

        names = [
            specialty["name"]
            for specialty in specialties[:3]
        ]
        if len(specialties) > 3:
            remaining = len(specialties) - 3
            labels = f"{', '.join(names)}, and {remaining} more"
        elif len(names) == 2:
            labels = f"{names[0]} and {names[1]}"
        else:
            labels = f"{names[0]}, {names[1]}, and {names[2]}"
        return (
            f"{author} vouched for {len(specialties)} of your specialties: "
            f"{labels}."
        )

    @staticmethod
    @transaction.atomic
    def record(vouch):
        """Append each vouch once while serializing writes with the vouch creator lock."""
        # Match VouchService's first lock; this also serializes direct event replays.
        try:
            author = User.objects.select_for_update().get(
                pk=vouch.USER_ID_id,
            )
        except User.DoesNotExist:
            raise NotFound("The user could not be found.") from None
        recipient = vouch.BUSN_ID.USER_ID
        event_key = f"business-vouch:{vouch.pk}:created"
        recipient_notices = Notification.objects.filter(
            USER_ID=recipient,
            NOTF_TYPE=VouchNotificationService.EVENT_TYPE,
        )
        existing = recipient_notices.filter(
            Q(NOTF_DEDUP_KEY=event_key)
            | Q(NOTF_METADATA__contains={"vouch_ids": [vouch.pk]}),
        ).first()
        if existing is not None:
            return existing

        now = timezone.now()
        group = recipient_notices.filter(
            NOTF_READ_AT__isnull=True,
            NOTF_CREATED_AT__gt=now - VouchNotificationService.GROUP_WINDOW,
            NOTF_CREATED_AT__lte=now,
            NOTF_METADATA__contains={
                "actor_id": author.pk,
                "business_id": vouch.BUSN_ID_id,
            },
        ).first()
        specialty = {
            "id": vouch.TAG_ID_id,
            "name": vouch.TAG_ID.TAG_NAME,
        }
        if group is not None:
            metadata = deepcopy(group.NOTF_METADATA)
            metadata["vouch_ids"].append(vouch.pk)
            known_specialties = {
                item["id"]
                for item in metadata["specialties"]
            }
            if specialty["id"] not in known_specialties:
                metadata["specialties"].append(specialty)

            # A read may commit after the lookup. Never overwrite its acknowledged body.
            updated = Notification.objects.filter(
                pk=group.pk,
                NOTF_READ_AT__isnull=True,
            ).update(
                NOTF_BODY=VouchNotificationService._body(metadata),
                NOTF_METADATA=metadata,
                NOTF_UPDATED_AT=now,
            )
            if updated:
                NotificationRealtimeService.schedule(recipient.pk)
                group.refresh_from_db()
                return group

        metadata = {
            "actor_id": author.pk,
            "business_id": vouch.BUSN_ID_id,
            "author_name": author.full_name.strip() or "An explorer",
            "specialties": [specialty],
            "vouch_ids": [vouch.pk],
        }
        return NotificationService.create(
            recipient=recipient,
            event_type=VouchNotificationService.EVENT_TYPE,
            title="New specialty vouch",
            body=VouchNotificationService._body(metadata),
            dedup_key=event_key,
            metadata=metadata,
        )
