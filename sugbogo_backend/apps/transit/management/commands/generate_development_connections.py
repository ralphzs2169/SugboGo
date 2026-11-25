"""Expose bounded development graph generation without transit imports."""

import json

from django.core.management.base import BaseCommand, CommandError

from apps.transit.services.development_connection_graph_service import DevelopmentConnectionGraphService


class Command(BaseCommand):
    """Generate or resume a local development graph from an in-memory seed dataset."""

    help = "Generate verified development transfer artifacts in .connection-graphs."

    def add_arguments(
        self,
        parser,
    ):
        """Require a dataset and local database confirmation with an optional checkpoint stop."""
        parser.add_argument("--dataset", required=True)
        parser.add_argument("--confirm-database", required=True)
        parser.add_argument("--maximum-pairs", type=int)

    def handle(
        self,
        *args,
        **options,
    ):
        """Report complete, empty, pending and failed pair counts without mutating transit records."""
        maximum_pairs = options["maximum_pairs"]
        if maximum_pairs is not None and maximum_pairs < 1:
            raise CommandError("--maximum-pairs must be positive.")
        try:
            service = DevelopmentConnectionGraphService(
                dataset=options["dataset"],
                confirmation=options["confirm_database"],
            )
            result = service.build(maximum_pairs=maximum_pairs)
        except Exception as error:
            raise CommandError(str(error)) from error
        self.stdout.write(json.dumps(result, indent=2))
        if result["pending"] or result["failed"]:
            raise CommandError("Graph remains incomplete; resume this command to continue.")

