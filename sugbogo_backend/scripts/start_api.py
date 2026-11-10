"""Start only the existing Daphne ASGI API using the hosting environment's port."""

import os
import sys


def main():
    """Validate the listening port and replace this process with Daphne."""
    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError:
        raise SystemExit("PORT must be an integer between 1 and 65535.") from None
    if not 1 <= port <= 65535:
        raise SystemExit("PORT must be an integer between 1 and 65535.")

    os.execvp(
        sys.executable,
        [
            sys.executable,
            "-m",
            "daphne",
            "-b",
            "0.0.0.0",
            "-p",
            str(port),
            "--websocket-max-message-size",
            "8192",
            "config.asgi:application",
        ],
    )


if __name__ == "__main__":
    main()
