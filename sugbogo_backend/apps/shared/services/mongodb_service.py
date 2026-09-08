from django.conf import settings
from pymongo import MongoClient
from pymongo.server_api import ServerApi


class MongoDBService:
    """
    Provides access to the configured MongoDB database.

    Uses a shared MongoClient instance and exposes a small health-check method
    so MongoDB connectivity can be verified without coupling callers to PyMongo.
    """

    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            cls._client = MongoClient(
                settings.MONGODB_URI,
                server_api=ServerApi("1"),
            )

        return cls._client

    @classmethod
    def get_database(cls):
        return cls.get_client()[settings.MONGODB_DATABASE]

    @classmethod
    def ping(cls):
        cls.get_client().admin.command("ping")
        return True