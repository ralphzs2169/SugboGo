"""Offline command safety checks; no PostgreSQL connection is permitted."""

import hashlib
import json
from contextlib import nullcontext
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from apps.transit.management.commands.import_approved_transit import Command
from apps.transit.services.tests.test_transit_seed_service import reviewed_fixture


class ApprovedTransitImportTests(SimpleTestCase):
    """Test release gates and read-only planning without creating any database."""

    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.payload = reviewed_fixture()
        self.payload['routes'][0]['variants'][0]['review']['status'] = 'needs_review'
        self.raw = json.dumps(self.payload).encode()
        self.dataset = self.directory / 'seed.json'
        self.dataset.write_bytes(self.raw)
        self.options = {
            'dataset': str(self.dataset),
            'dataset_sha256': hashlib.sha256(self.raw).hexdigest(),
            'expected_variants': 1,
            'confirm_database': 'release',
            'confirm_host': 'explicit-host',
            'confirm_port': '5432',
            'apply': False,
            'pg_restore': 'pg_restore',
        }
        self.target = {'database': 'release', 'host': 'explicit-host', 'port': '5432'}

    def test_checksum_count_and_review_metadata(self):
        raw, data = Command.read_dataset(self.options)
        self.assertEqual(raw, self.raw)
        self.assertEqual(data['routes'][0]['variants'][0]['review']['status'], 'needs_review')
        for key, value in [('dataset_sha256', '0' * 64), ('expected_variants', 71)]:
            with self.subTest(key=key), self.assertRaises(CommandError):
                Command.read_dataset({**self.options, key: value})

    @override_settings(DEBUG=False)
    def test_wrong_target_is_rejected_before_connecting(self):
        with patch('apps.transit.management.commands.import_approved_transit.connection') as database:
            database.settings_dict = {'ENGINE': 'django.contrib.gis.db.backends.postgis', 'NAME': 'other'}
            with self.assertRaises(CommandError):
                Command.target(self.options)
            database.cursor.assert_not_called()

    def test_preview_sets_read_only_and_never_applies(self):
        module = 'apps.transit.management.commands.import_approved_transit'
        with patch(module + '.transaction.atomic', return_value=nullcontext()), patch(module + '.connection') as database, patch(module + '.TransitSeedService') as seed:
            database.cursor.return_value.__enter__.return_value.fetchone.return_value = ('release',)
            seed._plan.return_value = {'points': {}, 'routes': {}}
            seed._report.return_value = {'applied': False}
            result = Command.preview({}, self.target)
            statements = database.cursor.return_value.__enter__.return_value.execute.call_args_list
            self.assertIn('READ ONLY', statements[0].args[0])
            self.assertEqual(len(result['plan_sha256']), 64)
            seed._apply.assert_not_called()

    def test_apply_without_authorization_does_not_touch_database(self):
        command = Command(stdout=StringIO())
        with patch.object(Command, 'target', return_value=self.target), patch.object(Command, 'verify_backup') as backup:
            with self.assertRaises(CommandError):
                command.handle(**{**self.options, 'apply': True})
            backup.assert_not_called()

    def test_backup_requires_target_hash_and_restore_attestation(self):
        archive = self.directory / 'backup.dump'
        archive.write_bytes(b'fixture archive')
        manifest = self.directory / 'backup.json'
        now = datetime.now(timezone.utc).isoformat()
        metadata = {
            **self.target, 'created_at': now, 'restore_verified_at': now,
            'restore_verified': True, 'verified_by': 'Test operator',
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        }
        options = {**self.options, 'backup_file': str(archive), 'backup_manifest': str(manifest)}
        for field, value in [('database', 'wrong'), ('sha256', '0' * 64), ('restore_verified', False)]:
            manifest.write_text(json.dumps({**metadata, field: value}))
            with self.subTest(field=field), patch('apps.transit.management.commands.import_approved_transit.subprocess.run') as process:
                with self.assertRaises(CommandError):
                    Command.verify_backup(options, self.target)
                process.assert_not_called()
        manifest.write_text(json.dumps(metadata))
        with patch('apps.transit.management.commands.import_approved_transit.subprocess.run') as process:
            self.assertEqual(Command.verify_backup(options, self.target), metadata)
            self.assertEqual(process.call_args.args[0][1], '--file=-')
            self.assertTrue(process.call_args.kwargs['check'])
    def test_apply_rechecks_plan_and_preserves_metadata_in_receipt(self):
        from contextlib import ExitStack
        module = 'apps.transit.management.commands.import_approved_transit'
        plan = {'points': {}, 'routes': {}}
        report = {'applied': False}
        options = {
            **self.options,
            'apply': True,
            'approval_reference': 'PM-release-ticket',
            'confirm_plan_sha256': Command.plan_digest(plan, report),
            'backup_file': 'backup.dump',
            'backup_manifest': 'backup.json',
            'receipt': str(self.directory / 'receipt.json'),
        }
        with ExitStack() as stack:
            stack.enter_context(patch.object(Command, 'target', return_value=self.target))
            stack.enter_context(patch.object(Command, 'verify_backup', return_value={'verified': True}))
            stack.enter_context(patch(module + '.transaction.atomic', return_value=nullcontext()))
            database = stack.enter_context(patch(module + '.connection'))
            database.cursor.return_value.__enter__.return_value.fetchone.return_value = ('release',)
            stack.enter_context(patch(module + '.TransitSpatialValidationService.lock_network'))
            seed = stack.enter_context(patch(module + '.TransitSeedService'))
            seed._plan.return_value = plan
            seed._report.return_value = report
            seed._apply.return_value = {'applied': True}
            Command(stdout=StringIO()).handle(**options)
            seed._apply.assert_called_once()
        receipt = json.loads(Path(options['receipt']).read_text())
        self.assertEqual(receipt['status'], 'committed')
        self.assertEqual(receipt['source_metadata']['routes'][0]['variants'][0]['review']['status'], 'needs_review')
        self.assertEqual(Path(options['receipt'] + '.source.json').read_bytes(), self.raw)

    def test_changed_preview_plan_prevents_apply(self):
        from contextlib import ExitStack
        module = 'apps.transit.management.commands.import_approved_transit'
        options = {
            **self.options, 'apply': True, 'approval_reference': 'PM-ticket',
            'confirm_plan_sha256': '0' * 64, 'backup_file': 'backup.dump',
            'backup_manifest': 'backup.json', 'receipt': str(self.directory / 'changed.json'),
        }
        with ExitStack() as stack:
            stack.enter_context(patch.object(Command, 'target', return_value=self.target))
            stack.enter_context(patch.object(Command, 'verify_backup', return_value={}))
            stack.enter_context(patch(module + '.transaction.atomic', return_value=nullcontext()))
            database = stack.enter_context(patch(module + '.connection'))
            database.cursor.return_value.__enter__.return_value.fetchone.return_value = ('release',)
            stack.enter_context(patch(module + '.TransitSpatialValidationService.lock_network'))
            seed = stack.enter_context(patch(module + '.TransitSeedService'))
            seed._plan.return_value = {'points': {}, 'routes': {}}
            seed._report.return_value = {'applied': False}
            with self.assertRaisesMessage(CommandError, 'plan changed'):
                Command(stdout=StringIO()).handle(**options)
            seed._apply.assert_not_called()

    @override_settings(DEBUG=False)
    def test_local_importer_still_refuses_production(self):
        from rest_framework.exceptions import PermissionDenied
        from apps.transit.management.commands.import_local_draft_transit import Command as LocalCommand
        with self.assertRaises(PermissionDenied):
            LocalCommand._confirm('release')
