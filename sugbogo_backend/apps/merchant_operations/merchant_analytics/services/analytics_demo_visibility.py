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

    def __init__(self):
        """Resolve the configured database without initializing collections or indexes."""
        self.database = MongoDBService.get_database()
        if self.database.name != settings.MONGODB_DATABASE:
            raise ValidationError(
                "The resolved MongoDB database does not match the configured database.",
            )
        self.collection = self.database[VisibilityEventService.COLLECTION_NAME]

    def inspect(
        self,
        business_id,
    ):
        """Report existing target counts and reject conflicting named indexes without writing."""
        indexes = self.collection.index_information()
        for name, expected in INDEXES.items():
            existing = indexes.get(name)
            if existing is not None and (
                list(existing["key"]) != expected["key"]
                or bool(existing.get("unique", False)) != expected["unique"]
            ):
                raise ValidationError(
                    "An existing named visibility index conflicts with the required schema.",
                )
        names = self.database.list_collection_names(
            filter={"name": VisibilityEventService.COLLECTION_NAME},
        )
        return {
            "collection_exists": VisibilityEventService.COLLECTION_NAME in names,
            "observations": self.collection.count_documents({"business_id": business_id}),
            "missing_indexes": [
                name
                for name in INDEXES
                if name not in indexes
            ],
        }

    def verify(
        self,
        documents,
        actor_ids,
    ):
        """Refuse edited or unrelated observations referencing any of the reserved demo actors."""
        expected = {
            row["dedupe_key"]: normalized_document(row)
            for row in documents
        }
        seen = set()
        for row in self.collection.find({"explorer_id": {"$in": list(actor_ids)}}):
            key = row.get("dedupe_key")
            if (
                key not in expected
                or key in seen
                or fingerprint(normalized_document(row)) != fingerprint(expected[key])
            ):
                raise ValidationError(
                    "Demo explorers have edited or unrelated visibility observations; refusing mutation.",
                )
            seen.add(key)

    def apply(
        self,
        documents,
        actor_ids,
    ):
        """Resume idempotent inserts without replacing any existing observation or index."""
        self.verify(documents, actor_ids)
        if documents:
            current = self.collection.index_information()
            for name, options in INDEXES.items():
                if name not in current:
                    self.collection.create_index(
                        options["key"],
                        unique=options["unique"],
                        name=name,
                    )
        inserted = 0
        for document in documents:
            # Matching every field makes a concurrent edit fail the unique-key insert,
            # rather than silently treating a foreign observation as our own.
            result = self.collection.update_one(
                document,
                {"$setOnInsert": document},
                upsert=True,
            )
            if result.upserted_id is not None:
                inserted += 1
        self.verify(documents, actor_ids)
        return inserted

    def cleanup(
        self,
        documents,
        actor_ids,
    ):
        """Delete only exact planned documents while retaining shared collections and indexes."""
        self.verify(documents, actor_ids)
        deleted = 0
        for document in documents:
            result = self.collection.delete_one(document)
            deleted += result.deleted_count
            remaining = self.collection.find_one({
                "dedupe_key": document["dedupe_key"],
            })
            if result.deleted_count == 0 and remaining is not None:
                raise ValidationError(
                    "A visibility observation changed during cleanup; SQL records were retained.",
                )
        return deleted
