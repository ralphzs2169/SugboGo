"""Small atomic Mongo double using the existing analytics pipeline evaluator."""

from threading import Lock
from types import SimpleNamespace

from apps.business.services.route_planning_event_service import RoutePlanningEventService
from .test_visibility_analytics_service import ReadOnlyCollection


class RoutePlanningCollection(ReadOnlyCollection):
    def __init__(self):
        super().__init__([])
        self.exists = False
        self.index_calls = []
        self.write_calls = []
        self.error = None
        self.lock = Lock()
        self.database = SimpleNamespace(
            list_collection_names=lambda **kwargs: (
                [RoutePlanningEventService.COLLECTION_NAME]
                if self.exists
                else []
            ),
        )

    def create_index(
        self,
        keys,
        **options,
    ):
        self.exists = True
        self.index_calls.append((keys, options))

    def update_one(
        self,
        query,
        update,
        upsert,
    ):
        with self.lock:
            self.write_calls.append((query, update, upsert))
            if self.error:
                raise self.error
            self.exists = True
            for document in self.documents:
                if all(document.get(key) == value for key, value in query.items()):
                    return SimpleNamespace(upserted_id=None)
            self.documents.append({**query, **update["$setOnInsert"]})
            return SimpleNamespace(upserted_id=len(self.documents))

    def find_one(
        self,
        query,
    ):
        if self.error:
            raise self.error
        return next(
            (
                document.copy()
                for document in self.documents
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )

    def expression(
        self,
        row,
        expression,
    ):
        if isinstance(expression, dict):
            if "$eq" in expression:
                left, right = expression["$eq"]
                return self.expression(row, left) == self.expression(row, right)
            if "$cond" in expression:
                condition, positive, negative = expression["$cond"]
                if self.expression(row, condition):
                    return self.expression(row, positive)
                return self.expression(row, negative)
            if "$add" in expression:
                return sum(
                    self.expression(row, value)
                    for value in expression["$add"]
                )
        return super().expression(row, expression)

    def aggregate(
        self,
        pipeline,
    ):
        if self.error:
            raise self.error
        original = self.documents
        owner_id = pipeline[0]["$match"]["explorer_id"]["$ne"]
        self.documents = [
            document
            for document in original
            if "navigation_method" in document
            and document["explorer_id"] != owner_id
        ]
        try:
            rows = list(super().aggregate(pipeline[:-1]))
        finally:
            self.documents = original
        for row in rows:
            row.pop("_id", None)
        return iter(rows)

    def initialize(
        self,
        timestamp,
    ):
        self.exists = True
        self.documents.append({
            "_id": RoutePlanningEventService.STATE_ID,
            "started_at": timestamp,
        })
