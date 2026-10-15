from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from rest_framework.exceptions import APIException

from apps.reviews.services.review_media_cleanup_service import ReviewMediaCleanupService


class Command(BaseCommand):
    """Restarts failed cleanup after an operator addresses the provider failure."""

    help = "Retry failed review media cleanup records by their cleanup IDs."

    def add_arguments(
        self,
        parser,
    ):
        """Accept explicit cleanup IDs without retrying all failures implicitly."""
        parser.add_argument("cleanup_ids", nargs="+", type=int)

    def handle(
        self,
        *args,
        **options,
    ):
        """Atomically reset the selected failures and request delivery after commit."""
        try:
            with transaction.atomic():
                for cleanup_id in sorted(set(options["cleanup_ids"])):
                    ReviewMediaCleanupService.requeue_failed(cleanup_id)
        except APIException as exc:
            raise CommandError(str(exc.detail)) from None
        self.stdout.write("Selected review media cleanup records queued for retry.")
