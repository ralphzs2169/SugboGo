from django.core.management.base import BaseCommand

from apps.authentication.services.login_history_service import LoginHistoryService


class Command(BaseCommand):
    help = "Delete login events older than the configured retention period."

    def handle(self, *args, **options):
        """Deletes expired account and anonymous events using the shared cutoff."""
        count = LoginHistoryService.prune()
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} expired login events."))
