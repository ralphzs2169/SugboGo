from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event, current_thread
from unittest.mock import patch

from django.db import connection, connections
from django.test import TransactionTestCase
from rest_framework.exceptions import APIException

from apps.reviews.models import ReplyPhoto, ReviewMediaCleanup, ReviewReply
from apps.reviews.services.review_reply_service import ReviewReplyService
from apps.reviews.services.tests.test_business_review_summary_service import (
    SummaryFixtureMixin,
)


class ReviewReplyConcurrencyTests(SummaryFixtureMixin, TransactionTestCase):
    """Exercise competing reply edits against real PostgreSQL transactions."""

    def setUp(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requires PostgreSQL row locks.")
        self.business = self.create_business()
        self.review = self.create_review(self.business)
        self.owner = self.business.USER_ID
        self.reply = ReviewReply.objects.create(
            REVW_ID=self.review,
            RPLY_TEXT="Original merchant reply.",
        )

    def _update(self, **kwargs):
        """Run an edit on a separate connection and report its HTTP outcome."""
        try:
            ReviewReplyService.update_reply(
                user=self.owner,
                reply_id=self.reply.pk,
                **kwargs,
            )
            return 200
        except APIException as exc:
            return exc.status_code
        finally:
            connections.close_all()

    def test_simultaneous_photo_additions_cannot_exceed_three(self):
        for index in range(2):
            ReplyPhoto.objects.create(
                RPLY_ID=self.reply,
                RPHO_PHOTO_URL=f"https://example.com/original-{index}.jpg",
                RPHO_PHOTO_PUBLIC_ID=f"reply/original-{index}",
            )
        uploading = Barrier(2)
        upload_transactions = []

        def upload(
            *args,
            **kwargs,
        ):
            upload_transactions.append(connections["default"].in_atomic_block)
            uploading.wait(timeout=10)
            public_id = f"reply/{current_thread().name}"
            return {
                "public_id": public_id,
                "secure_url": f"https://example.com/{public_id}.jpg",
            }

        with (
            patch(
                "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
                side_effect=upload,
            ),
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                return_value={"result": "ok"},
            ) as destroy,
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            first = executor.submit(self._update, photos=[object()])
            second = executor.submit(self._update, photos=[object()])
            outcomes = [first.result(timeout=15), second.result(timeout=15)]

        self.assertEqual(self.reply.photos.count(), 3)
        self.assertCountEqual(outcomes, [200, 409])
        self.assertEqual(upload_transactions, [False, False])
        destroy.assert_called_once()
        compensated = destroy.call_args.args[0]
        self.assertFalse(
            ReplyPhoto.objects.filter(RPHO_PHOTO_PUBLIC_ID=compensated).exists(),
        )

    def test_older_text_edit_cannot_overwrite_newer_committed_reply(self):
        source_read = Event()
        release_old = Event()
        get_reply = ReviewReplyService._get_reply

        def read_reply(reply_id):
            reply = get_reply(reply_id)
            if current_thread().name.startswith("older"):
                source_read.set()
                if not release_old.wait(10):
                    raise TimeoutError("Older reply edit was not released.")
            return reply

        with (
            patch.object(ReviewReplyService, "_get_reply", side_effect=read_reply),
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="older") as executor,
        ):
            older = executor.submit(self._update, text="Older proposed reply.")
            try:
                self.assertTrue(source_read.wait(10))
                ReviewReplyService.update_reply(
                    user=self.owner,
                    reply_id=self.reply.pk,
                    text="Newer committed reply.",
                )
            finally:
                release_old.set()
            outcome = older.result(timeout=15)

        self.reply.refresh_from_db()
        self.assertEqual(self.reply.RPLY_TEXT, "Newer committed reply.")
        self.assertEqual(outcome, 409)

    def test_reply_deletion_during_upload_cannot_resurrect_reply(self):
        uploading = Event()
        release_upload = Event()
        original = ReplyPhoto.objects.create(
            RPLY_ID=self.reply,
            RPHO_PHOTO_URL="https://example.com/original.jpg",
            RPHO_PHOTO_PUBLIC_ID="reply/original",
        )

        def upload(
            *args,
            **kwargs,
        ):
            self.assertFalse(connections["default"].in_atomic_block)
            uploading.set()
            if not release_upload.wait(10):
                raise TimeoutError("Reply upload was not released.")
            return {
                "public_id": "reply/abandoned",
                "secure_url": "https://example.com/abandoned.jpg",
            }

        with (
            patch(
                "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
                side_effect=upload,
            ),
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                return_value={"result": "ok"},
            ) as destroy,
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as dispatch,
            ThreadPoolExecutor(max_workers=1) as executor,
        ):
            pending = executor.submit(self._update, text="Abandoned edit.", photos=[object()])
            try:
                self.assertTrue(uploading.wait(10))
                ReviewReplyService.delete_reply(
                    user=self.owner,
                    reply_id=self.reply.pk,
                )
            finally:
                release_upload.set()
            self.assertEqual(pending.result(timeout=15), 404)

        self.assertFalse(ReviewReply.objects.filter(pk=self.reply.pk).exists())
        self.assertFalse(ReplyPhoto.objects.exists())
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(record.RMCU_PUBLIC_ID, original.RPHO_PHOTO_PUBLIC_ID)
        dispatch.assert_called_once_with(args=[record.pk], retry=False)
        destroy.assert_called_once_with(
            "reply/abandoned",
            resource_type="image",
            type="upload",
            timeout=15,
        )

    def test_photo_deletion_during_upload_invalidates_edit_source(self):
        photo = ReplyPhoto.objects.create(
            RPLY_ID=self.reply,
            RPHO_PHOTO_URL="https://example.com/original.jpg",
            RPHO_PHOTO_PUBLIC_ID="reply/original",
        )
        uploading = Event()
        release_upload = Event()

        def upload(
            *args,
            **kwargs,
        ):
            uploading.set()
            if not release_upload.wait(10):
                raise TimeoutError("Reply upload was not released.")
            return {
                "public_id": "reply/abandoned",
                "secure_url": "https://example.com/abandoned.jpg",
            }

        with (
            patch(
                "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
                side_effect=upload,
            ),
            patch(
                "apps.shared.services.cloudinary_service.cloudinary.uploader.destroy",
                return_value={"result": "ok"},
            ) as destroy,
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async"),
            ThreadPoolExecutor(max_workers=1) as executor,
        ):
            pending = executor.submit(self._update, photos=[object()])
            try:
                self.assertTrue(uploading.wait(10))
                ReviewReplyService.delete_photo(
                    user=self.owner,
                    photo_id=photo.pk,
                )
            finally:
                release_upload.set()
            self.assertEqual(pending.result(timeout=15), 409)
        self.assertFalse(ReplyPhoto.objects.exists())
        self.assertEqual(ReviewMediaCleanup.objects.get().RMCU_PUBLIC_ID, "reply/original")
        destroy.assert_called_once()

    def test_reply_deletion_waits_for_locked_update_and_captures_new_photo(self):
        applying = Event()
        release_update = Event()
        deletion_started = Event()
        deletion_finished = Event()
        save = ReviewReply.save

        def delayed_save(
            reply,
            *args,
            **kwargs,
        ):
            if current_thread().name.startswith("editing"):
                applying.set()
                if not release_update.wait(10):
                    raise TimeoutError("Reply update was not released.")
            return save(reply, *args, **kwargs)

        def observe_lock(
            execute,
            sql,
            params,
            many,
            context,
        ):
            if "FOR UPDATE" in sql:
                deletion_started.set()
            return execute(sql, params, many, context)

        def delete():
            try:
                with connections["default"].execute_wrapper(observe_lock):
                    ReviewReplyService.delete_reply(
                        user=self.owner,
                        reply_id=self.reply.pk,
                    )
            finally:
                deletion_finished.set()
                connections.close_all()

        with (
            patch.object(ReviewReply, "save", delayed_save),
            patch(
                "apps.reviews.services.review_reply_service.CloudinaryService.upload_image",
                return_value={
                    "public_id": "reply/new",
                    "secure_url": "https://example.com/new.jpg",
                },
            ),
            patch("apps.reviews.tasks.cleanup_review_media_asset.apply_async") as dispatch,
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="editing") as editors,
            ThreadPoolExecutor(max_workers=1) as deleters,
        ):
            edit = editors.submit(self._update, photos=[object()])
            try:
                self.assertTrue(applying.wait(10))
                deletion = deleters.submit(delete)
                self.assertTrue(deletion_started.wait(10))
                self.assertFalse(deletion_finished.wait(0.1))
            finally:
                release_update.set()
            self.assertEqual(edit.result(timeout=15), 200)
            deletion.result(timeout=15)
        self.assertFalse(ReplyPhoto.objects.exists())
        self.assertFalse(ReviewReply.objects.exists())
        record = ReviewMediaCleanup.objects.get()
        self.assertEqual(record.RMCU_PUBLIC_ID, "reply/new")
        dispatch.assert_called_once_with(args=[record.pk], retry=False)
