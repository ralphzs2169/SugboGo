"""Validate API startup without binding ports or starting application services."""

import os
import sys
from unittest.mock import patch

from django.test import SimpleTestCase

from scripts.start_api import main


class APIStartupTests(SimpleTestCase):
    """Keep the API process configurable and separate from release operations."""

    def test_default_and_environment_ports_replace_process_with_daphne(self):
        """Launch the existing ASGI app on an external interface without a shell."""
        for environment, expected_port in (
            ({}, "8000"),
            ({"PORT": "9123"}, "9123"),
        ):
            with self.subTest(port=expected_port):
                with (
                    patch.dict(os.environ, environment, clear=True),
                    patch("scripts.start_api.os.execvp") as execute,
                ):
                    main()
                execute.assert_called_once_with(
                    sys.executable,
                    [
                        sys.executable,
                        "-m",
                        "daphne",
                        "-b",
                        "0.0.0.0",
                        "-p",
                        expected_port,
                        "--websocket-max-message-size",
                        "8192",
                        "config.asgi:application",
                    ],
                )

    def test_invalid_ports_fail_before_starting_the_server(self):
        """Reject invalid configuration rather than silently changing the port."""
        for value in ("", "invalid", "0", "-1", "65536"):
            with self.subTest(port=value):
                with (
                    patch.dict(os.environ, {"PORT": value}, clear=True),
                    patch("scripts.start_api.os.execvp") as execute,
                ):
                    with self.assertRaisesRegex(SystemExit, "PORT must be"):
                        main()
                execute.assert_not_called()
