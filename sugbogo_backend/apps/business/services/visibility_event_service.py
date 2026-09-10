import logging
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from threading import Lock
from time import monotonic

from django.conf import settings
from django.utils import timezone
from pymongo import ASCENDING, UpdateOne
from pymongo.errors import BulkWriteError, DuplicateKeyError, PyMongoError
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError

from apps.business.models import Business
from apps.shared.services.mongodb_service import MongoDBService

logger = logging.getLogger(__name__)


class VisibilityTrackingUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Visibility tracking is temporarily unavailable."
    default_code = "visibility_tracking_unavailable"

    def __init__(
        self,
        *args,
        cooldown_short_circuit=False,
        **kwargs,
    ):
        super().__init__(
            *args,
            **kwargs,
        )
        self.cooldown_short_circuit = cooldown_short_circuit


class VisibilityEventType(StrEnum):
    IMPRESSION = "IMPRESSION"
    PROFILE_VISIT = "PROFILE_VISIT"
    SAVE = "SAVE"


@dataclass(frozen=True)
class VisibilityEventWriteResult:
    event_type: VisibilityEventType
    eligible_business_ids: tuple[int, ...]
    recorded_count: int
    duplicate_count: int


class VisibilityEventService:
    """Records minimal, deduplicated visibility analytics in MongoDB."""

    COLLECTION_NAME = "discovery_visibility_events"
    DEDUPE_INDEX_NAME = "visibility_event_dedupe_key_unique"
    AGGREGATION_INDEX_NAME = "visibility_event_business_time"

    _indexes_initialized = False
    _index_lock = Lock()
    _availability_lock = Lock()
    _unavailable_until = 0.0

    @staticmethod
    def _get_monotonic_time() -> float:
        return monotonic()

    @classmethod
    def _raise_if_temporarily_unavailable(cls):
        with cls._availability_lock:
            unavailable_until = cls._unavailable_until

        if cls._get_monotonic_time() < unavailable_until:
            raise VisibilityTrackingUnavailable(
                cooldown_short_circuit=True,
            )

    @classmethod
    def _mark_temporarily_unavailable(cls):
        cooldown_seconds = (
            settings.MONGODB_VISIBILITY_FAILURE_COOLDOWN_SECONDS
        )
        unavailable_until = (
            cls._get_monotonic_time()
            + cooldown_seconds
        )

        with cls._availability_lock:
            cls._unavailable_until = unavailable_until

    @classmethod
    def _clear_temporary_unavailability(cls):
        with cls._availability_lock:
            cls._unavailable_until = 0.0

    @classmethod
    def _get_collection(cls):
        database = MongoDBService.get_database()

        return database[cls.COLLECTION_NAME]

    @classmethod
    def ensure_indexes(cls):
        cls._raise_if_temporarily_unavailable()

        if cls._indexes_initialized:
            return

        with cls._index_lock:
            cls._raise_if_temporarily_unavailable()

            if cls._indexes_initialized:
                return

            try:
                collection = cls._get_collection()
                collection.create_index(
                    [
                        (
                            "dedupe_key",
                            ASCENDING,
                        ),
                    ],
                    unique=True,
                    name=cls.DEDUPE_INDEX_NAME,
                )
                collection.create_index(
                    [
                        (
                            "event_type",
                            ASCENDING,
                        ),
                        (
                            "business_id",
                            ASCENDING,
                        ),
                        (
                            "occurred_at",
                            ASCENDING,
                        ),
                    ],
                    name=cls.AGGREGATION_INDEX_NAME,
                )
            except PyMongoError as exc:
                cls._mark_temporarily_unavailable()
                logger.exception(
                    "Failed to initialize visibility-event indexes.",
                )
                raise VisibilityTrackingUnavailable() from exc

            cls._indexes_initialized = True
            cls._clear_temporary_unavailability()

    @staticmethod
    def _get_current_time() -> datetime:
        return timezone.now()

    @staticmethod
    def _get_event_day(
        occurred_at: datetime,
    ) -> str:
        return timezone.localtime(
            occurred_at,
            timezone=timezone.get_default_timezone(),
        ).date().isoformat()

    @staticmethod
    def _build_dedupe_key(
        event_type: VisibilityEventType,
        explorer_id: int,
        business_id: int,
        event_day: str,
    ) -> str:
        return ":".join(
            [
                event_type.value,
                str(explorer_id),
                str(business_id),
                event_day,
            ],
        )

    @staticmethod
    def _normalize_business_ids(
        business_ids: Iterable[int],
    ) -> list[int]:
        return sorted(
            set(
                business_ids,
            ),
        )

    @staticmethod
    def _validate_active_business_ids(
        business_ids: Iterable[int],
    ) -> list[int]:
        normalized_business_ids = (
            VisibilityEventService._normalize_business_ids(
                business_ids,
            )
        )

        if not normalized_business_ids:
            return []

        eligible_business_ids = list(
            Business.objects.filter(
                BUSN_ID__in=normalized_business_ids,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
            .order_by(
                "BUSN_ID",
            )
            .values_list(
                "BUSN_ID",
                flat=True,
            ),
        )

        if eligible_business_ids != normalized_business_ids:
            raise ValidationError(
                {
                    "business_ids": [
                        (
                            "One or more businesses could not be found "
                            "or are not active."
                        ),
                    ],
                },
            )

        return eligible_business_ids

    @staticmethod
    def _validate_active_business(
        business_id: int,
    ) -> Business:
        try:
            return Business.objects.get(
                BUSN_ID=business_id,
                BUSN_STATUS=Business.BusinessStatus.ACTIVE,
            )
        except Business.DoesNotExist:
            raise NotFound(
                "The business could not be found.",
            )

    @classmethod
    def _record_events(
        cls,
        event_type: VisibilityEventType,
        explorer_id: int,
        business_ids: Iterable[int],
        occurred_at: datetime,
    ) -> VisibilityEventWriteResult:
        normalized_business_ids = cls._normalize_business_ids(
            business_ids,
        )

        if not normalized_business_ids:
            return VisibilityEventWriteResult(
                event_type=event_type,
                eligible_business_ids=(),
                recorded_count=0,
                duplicate_count=0,
            )

        cls.ensure_indexes()
        event_day = cls._get_event_day(
            occurred_at,
        )
        documents = []

        for business_id in normalized_business_ids:
            dedupe_key = cls._build_dedupe_key(
                event_type=event_type,
                explorer_id=explorer_id,
                business_id=business_id,
                event_day=event_day,
            )
            documents.append(
                {
                    "event_type": event_type.value,
                    "business_id": business_id,
                    "explorer_id": explorer_id,
                    "occurred_at": occurred_at,
                    "dedupe_key": dedupe_key,
                },
            )

        operations = [
            UpdateOne(
                {
                    "dedupe_key": document["dedupe_key"],
                },
                {
                    "$setOnInsert": document,
                },
                upsert=True,
            )
            for document in documents
        ]

        try:
            collection = cls._get_collection()
            result = collection.bulk_write(
                operations,
                ordered=False,
            )
            recorded_count = result.upserted_count
        except DuplicateKeyError:
            recorded_count = 0
            cls._clear_temporary_unavailability()
        except BulkWriteError as exc:
            error_details = exc.details or {}
            write_errors = error_details.get(
                "writeErrors",
                [],
            )

            if not write_errors or any(
                error.get("code") != 11000
                for error in write_errors
            ):
                cls._mark_temporarily_unavailable()
                logger.exception(
                    "Failed to record visibility events.",
                )
                raise VisibilityTrackingUnavailable() from exc

            recorded_count = error_details.get(
                "nUpserted",
                0,
            )
            cls._clear_temporary_unavailability()
        except PyMongoError as exc:
            cls._mark_temporarily_unavailable()
            logger.exception(
                "Failed to record visibility events.",
            )
            raise VisibilityTrackingUnavailable() from exc
        else:
            cls._clear_temporary_unavailability()

        return VisibilityEventWriteResult(
            event_type=event_type,
            eligible_business_ids=tuple(
                normalized_business_ids,
            ),
            recorded_count=recorded_count,
            duplicate_count=(
                len(normalized_business_ids)
                - recorded_count
            ),
        )

    @classmethod
    def record_impressions(
        cls,
        explorer_id: int,
        business_ids: Iterable[int],
    ) -> VisibilityEventWriteResult:
        """Records visibility impressions for a list of businesses."""

        eligible_business_ids = cls._validate_active_business_ids(
            business_ids,
        )

        return cls._record_events(
            event_type=VisibilityEventType.IMPRESSION,
            explorer_id=explorer_id,
            business_ids=eligible_business_ids,
            occurred_at=cls._get_current_time(),
        )

    @classmethod
    def record_profile_visit(
        cls,
        explorer_id: int,
        business_id: int,
    ) -> VisibilityEventWriteResult:
        """Records a visibility profile visit for a single business."""

        business = cls._validate_active_business(
            business_id=business_id,
        )

        return cls._record_events(
            event_type=VisibilityEventType.PROFILE_VISIT,
            explorer_id=explorer_id,
            business_ids=[
                business.BUSN_ID,
            ],
            occurred_at=cls._get_current_time(),
        )

    @classmethod
    def record_save(
        cls,
        explorer_id: int,
        business_id: int,
    ) -> VisibilityEventWriteResult:
        """Records a visibility save event for a single business."""
        business = cls._validate_active_business(
            business_id=business_id,
        )

        return cls._record_events(
            event_type=VisibilityEventType.SAVE,
            explorer_id=explorer_id,
            business_ids=[
                business.BUSN_ID,
            ],
            occurred_at=cls._get_current_time(),
        )

    @classmethod
    def get_recent_visibility_metrics(
        cls,
        business_ids: Iterable[int],
        start_time: datetime,
        end_time: datetime,
    ) -> dict[int, dict[str, int]]:
        """Retrieves recent visibility metrics for a list of businesses."""
        
        normalized_business_ids = cls._normalize_business_ids(
            business_ids,
        )
        metrics = {
            business_id: {
                "impression_count": 0,
                "profile_visit_count": 0,
                "save_event_count": 0,
                "unique_saver_count": 0,
            }
            for business_id in normalized_business_ids
        }

        if not normalized_business_ids:
            return metrics

        cls.ensure_indexes()
        pipeline = [
            {
                "$match": {
                    "business_id": {
                        "$in": normalized_business_ids,
                    },
                    "event_type": {
                        "$in": [
                            event_type.value
                            for event_type in VisibilityEventType
                        ],
                    },
                    "occurred_at": {
                        "$gte": start_time,
                        "$lt": end_time,
                    },
                },
            },
            {
                "$group": {
                    "_id": {
                        "business_id": "$business_id",
                        "event_type": "$event_type",
                    },
                    "event_count": {
                        "$sum": 1,
                    },
                    "explorer_ids": {
                        "$addToSet": "$explorer_id",
                    },
                },
            },
        ]

        try:
            collection = cls._get_collection()
            rows = collection.aggregate(
                pipeline,
            )

            for row in rows:
                business_id = row["_id"]["business_id"]
                event_type = row["_id"]["event_type"]
                event_count = row["event_count"]

                if event_type == VisibilityEventType.IMPRESSION.value:
                    metrics[business_id]["impression_count"] = event_count
                elif event_type == VisibilityEventType.PROFILE_VISIT.value:
                    metrics[business_id]["profile_visit_count"] = (
                        event_count
                    )
                elif event_type == VisibilityEventType.SAVE.value:
                    metrics[business_id]["save_event_count"] = event_count
                    metrics[business_id]["unique_saver_count"] = len(
                        row["explorer_ids"],
                    )
        except PyMongoError as exc:
            cls._mark_temporarily_unavailable()
            logger.exception(
                "Failed to read recent visibility metrics.",
            )
            raise VisibilityTrackingUnavailable() from exc
        else:
            cls._clear_temporary_unavailability()

        return metrics

    @classmethod
    def get_profile_visit_business_ids(
        cls,
        explorer_id: int,
    ) -> list[int]:
        """Returns one business ID for each stored deduplicated profile visit."""

        cls.ensure_indexes()

        try:
            collection = cls._get_collection()
            rows = collection.find(
                {
                    "explorer_id": explorer_id,
                    "event_type": VisibilityEventType.PROFILE_VISIT.value,
                },
                {
                    "_id": 0,
                    "business_id": 1,
                },
            )

            business_ids = [
                row["business_id"]
                for row in rows
                if isinstance(row.get("business_id"), int)
            ]
        except PyMongoError as exc:
            cls._mark_temporarily_unavailable()
            logger.exception(
                "Failed to read Explorer profile-visit events.",
            )
            raise VisibilityTrackingUnavailable() from exc

        cls._clear_temporary_unavailability()

        return business_ids
