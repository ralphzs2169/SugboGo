"""Index an already completed local development graph without spatial discovery."""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.transit.services.development_connection_graph_index import (
    SHA256_PATTERN,
    DevelopmentConnectionGraphIndex,
)


class Command(BaseCommand):
    """Publish a directional pair sidecar for an existing graph revision."""

    help = "Index a completed revision in .connection-graphs without modifying its graph."

    def add_arguments(
        self,
        parser,
    ):
        """Require the exact inventory revision to index."""
        parser.add_argument("--revision", required=True)

    def handle(
        self,
        *args,
        **options,
    ):
        """Verify the completed graph and report the sidecar's coverage and size."""
        if not settings.DEBUG:
            raise CommandError("Development graph indexing requires DEBUG=True.")
        revision = options["revision"]
        if SHA256_PATTERN.fullmatch(revision) is None:
            raise CommandError("Provide the graph's 64-character SHA-256 revision.")
        directory = settings.BASE_DIR / ".connection-graphs" / revision
        try:
            result = DevelopmentConnectionGraphIndex.publish(directory)
        except (OSError, ValueError) as error:
            raise CommandError(str(error)) from error
        self.stdout.write(json.dumps(result, indent=2))
