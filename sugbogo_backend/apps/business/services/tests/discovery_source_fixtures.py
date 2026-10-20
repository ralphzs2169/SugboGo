"""Atomic in-memory writes and the Mongo expressions used by source reporting."""

from threading import Lock
from types import SimpleNamespace

from .test_visibility_analytics_service import ReadOnlyCollection


class DiscoverySourceCollection(ReadOnlyCollection):
    def __init__(self):
        super().__init__([])
        self.exists = True
        self.error = None
        self.index_calls = []
        self.lock = Lock()
        self.database = SimpleNamespace(
            list_collection_names=lambda **kwargs: (
                ["discovery_visibility_events"]
                if self.exists
                else []
            ),
        )

    def create_index(
        self,
        keys,
        **options,
    ):
        self.index_calls.append((keys, options))

    def bulk_write(
        self,
        operations,
        ordered,
    ):
        if self.error:
            raise self.error
        inserted = 0
        with self.lock:
            for operation in operations:
                key = operation._filter["dedupe_key"]
                if any(row.get("dedupe_key") == key for row in self.documents):
                    continue
                self.documents.append(operation._doc["$setOnInsert"].copy())
                inserted += 1
        return SimpleNamespace(upserted_count=inserted)

    def expression(
        self,
        row,
        expression,
    ):
        if expression == "$discovery_source":
            return row.get("discovery_source")
        if isinstance(expression, dict):
            if "$ifNull" in expression:
                value, fallback = expression["$ifNull"]
                result = self.expression(row, value)
                if result is None:
                    return self.expression(row, fallback)
                return result
            if "$in" in expression:
                value, choices = expression["$in"]
                return self.expression(row, value) in choices
            if "$cond" in expression:
                condition, positive, negative = expression["$cond"]
                if self.expression(row, condition):
                    return self.expression(row, positive)
                return self.expression(row, negative)
        return super().expression(row, expression)

    def aggregate(
        self,
        pipeline,
    ):
        if self.error:
            raise self.error
        return super().aggregate(pipeline)
