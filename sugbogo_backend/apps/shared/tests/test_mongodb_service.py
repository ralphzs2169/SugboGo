from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.shared.services.mongodb_service import MongoDBService


class MongoDBServiceTests(SimpleTestCase):
    def setUp(self):
        MongoDBService._client = None
        self.addCleanup(
            setattr,
            MongoDBService,
            "_client",
            None,
        )

    @override_settings(
        MONGODB_URI="mongodb://example.test",
        MONGODB_SERVER_SELECTION_TIMEOUT_MS=3000,
        MONGODB_CONNECT_TIMEOUT_MS=3000,
    )
    @patch(
        "apps.shared.services.mongodb_service.MongoClient",
    )
    def test_client_uses_bounded_connection_timeouts_and_is_reused(
        self,
        mongo_client,
    ):
        first = MongoDBService.get_client()
        second = MongoDBService.get_client()

        self.assertIs(
            first,
            second,
        )
        mongo_client.assert_called_once()
        _, kwargs = mongo_client.call_args
        self.assertEqual(
            kwargs["serverSelectionTimeoutMS"],
            3000,
        )
        self.assertEqual(
            kwargs["connectTimeoutMS"],
            3000,
        )
