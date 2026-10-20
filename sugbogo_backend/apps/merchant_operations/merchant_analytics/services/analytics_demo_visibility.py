"""Write only manifest-owned observations using the established visibility schema."""

from datetime import UTC, datetime

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.business.services.visibility_event_service import VisibilityEventService
from apps.shared.services.mongodb_service import MongoDBService

from .analytics_demo_manifest import fingerprint


INDEXES = {
    VisibilityEventService.DEDUPE_INDEX_NAME: {
        "key": [("dedupe_key", 1)],
        "unique": True,
    },
    VisibilityEventService.AGGREGATION_INDEX_NAME: {
        "key": [("event_type", 1), ("business_id", 1), ("occurred_at", 1)],
        "unique": False,
    },
}


def normalized_document(document):
    """Compare BSON's naive UTC dates with aware journal dates without changing observations."""
    result = {}
    for key, value in document.items():
        if key == "_id":
            continue
        if isinstance(value, datetime):
            if value.tzinfo is None:
                value = value.replace(tzinfo=UTC)
            value = value.astimezone(UTC).isoformat()
        result[key] = value
    return result


class AnalyticsDemoVisibility:
    """Keep read-only diagnostics separate from explicitly authorized fixture writes."""

    COLLECTION_NAME = VisibilityEventService.COLLECTION_NAME
    INDEXES = INDEXES

    def __init__(self):
        """Resolve the configured database without initializing collections or indexes."""
        self.database = MongoDBService.get_database()
        if self.database.name != settings.MONGODB_DATABASE:
            raise ValidationError(
                "The resolved MongoDB database does not match the configured database.",
            )
        self.collection = self.database[self.COLLECTION_NAME]

    @staticmethod
    def identity_query(document):
        """Identify one existing visibility observation without changing deduplication."""
        return {"dedupe_key": document["dedupe_key"]}

    def identity(
        self,
        document,
    ):
        """Return a hashable key for strict ownership verification."""
        return tuple(self.identity_query(document).items())

    def inspect(
        self,
        business_id,
    ):
        """Report existing target counts and reject conflicting named indexes without writing."""
        indexes = self.collection.index_information()
        for name, expected in self.INDEXES.items():
            existing = indexes.get(name)
            if existing is not None and (
                list(existing["key"]) != expected["key"]
                or bool(existing.get("unique", False)) != expected["unique"]
                or existing.get("partialFilterExpression") != expected.get("partialFilterExpression")
            ):
                raise ValidationError(
                    f"An existing named {self.COLLECTION_NAME} index conflicts with the required schema.",
                )
        names = self.database.list_collection_names(
            filter={"name": self.COLLECTION_NAME},
        )
        return {
            "collection_exists": self.COLLECTION_NAME in names,
            "observations": self.collection.count_documents({"business_id": business_id}),
            "missing_indexes": [
                name
                for name in self.INDEXES
                if name not in indexes
            ],
        }

    def verify(
        self,
        documents,
        actor_ids,
        legacy_documents=(),
        *,
        require_all=False,
    ):
        """Refuse edited or unrelated observations referencing any of the reserved demo actors."""
        expected = {}
        for row in (*documents, *legacy_documents):
            expected.setdefault(self.identity(row), set()).add(
                fingerprint(normalized_document(row)),
            )
        seen = set()
        for row in self.collection.find({"explorer_id": {"$in": list(actor_ids)}}):
            try:
                key = self.identity(row)
            except KeyError:
                raise ValidationError("A demo actor has an unrecognized observation schema.") from None
            if (
                key not in expected
                or key in seen
                or fingerprint(normalized_document(row)) not in expected[key]
            ):
                raise ValidationError(
                    "Demo explorers have edited or unrelated analytics observations; refusing mutation.",
                )
            seen.add(key)
        if require_all and seen != set(expected):
            raise ValidationError(
                "A completed seed-owned visibility observation is missing; "
                "refusing to regenerate previously seeded activity.",
            )

    def apply(
        self,
        documents,
        actor_ids,
        legacy_documents=(),
        *,
        allow_insert=True,
    ):
        """Resume idempotent inserts without replacing any existing observation or index."""
        self.verify(
            documents,
            actor_ids,
            legacy_documents,
            require_all=not allow_insert,
        )
        self.attributed_this_run = 0
        if documents:
            current = self.collection.index_information()
            for name, options in self.INDEXES.items():
                if name not in current:
                    self.collection.create_index(
                        options["key"],
                        unique=options["unique"],
                        name=name,
                        **{
                            key: value
                            for key, value in options.items()
                            if key == "partialFilterExpression"
                        },
                    )
        inserted = 0
        legacy = {
            self.identity(row): row
            for row in legacy_documents
        }
        for document in documents:
            previous = legacy.get(self.identity(document))
            if previous is not None:
                existing = self.collection.find_one(self.identity_query(document))
                if existing is not None and (
                    normalized_document(existing) == normalized_document(previous)
                ):
                    result = self.collection.update_one(
                        {**previous, "discovery_source": {"$exists": False}},
                        {"$set": {"discovery_source": document["discovery_source"]}},
                        upsert=False,
                    )
                    self.attributed_this_run += result.modified_count
                    refreshed = self.collection.find_one(self.identity_query(document))
                    if normalized_document(refreshed or {}) != normalized_document(document):
                        raise ValidationError(
                            "A seed-owned visit changed during attribution; resume after inspection.",
                        )
                    continue
            # Matching every field makes a concurrent edit fail the unique-key insert,
            # rather than silently treating a foreign observation as our own.
            result = self.collection.update_one(
                document,
                {"$setOnInsert": document},
                upsert=allow_insert,
            )
            if result.upserted_id is not None:
                inserted += 1
        self.verify(
            documents,
            actor_ids,
            legacy_documents,
            require_all=not allow_insert,
        )
        return inserted

    def cleanup(
        self,
        documents,
        actor_ids,
        legacy_documents=(),
    ):
        """Delete only exact planned documents while retaining shared collections and indexes."""
        self.verify(documents, actor_ids, legacy_documents)
        legacy = {
            self.identity(row): row
            for row in legacy_documents
        }
        deleted = 0
        for document in documents:
            result = self.collection.delete_one(document)
            previous = legacy.get(self.identity(document))
            if result.deleted_count == 0 and previous is not None:
                result = self.collection.delete_one({
                    **previous,
                    "discovery_source": {"$exists": False},
                })
            deleted += result.deleted_count
            remaining = self.collection.find_one(self.identity_query(document))
            if result.deleted_count == 0 and remaining is not None:
                raise ValidationError(
                    "A visibility observation changed during cleanup; SQL records were retained.",
                )
        return deleted
