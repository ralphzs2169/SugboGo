"""Explicitly enqueue a bounded pilot cohort without changing review data."""
from django.core.management.base import BaseCommand, CommandError
from apps.reviews.services.gemini_sentiment_shadow_service import GeminiSentimentShadowService


class Command(BaseCommand):
    help = 'Queue selected published reviews for opt-in Gemini shadow analysis only.'

    def add_arguments(self, parser):
        """Require explicit review IDs to prevent accidental historical backfills."""
        parser.add_argument('--review-id', type=int, action='append', required=True)

    def handle(self, *args, **options):
        """Create recoverable jobs only for eligible allowlisted review IDs."""
        ids = list(dict.fromkeys(options['review_id']))
        if len(ids) > 100 or any(value <= 0 for value in ids):
            raise CommandError('Provide between 1 and 100 positive review IDs.')
        for review_id in ids:
            job_id = GeminiSentimentShadowService.request(review_id)
            self.stdout.write(f'Review {review_id}: shadow job {job_id}' if job_id else f'Review {review_id}: skipped (disabled, outside cohort, unpublished, blank or missing)')
