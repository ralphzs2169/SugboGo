import hashlib

from django.db import connection


def lock_review_media_assets(
    assets,
    *,
    wait=True,
):
    """Serialize retention and deletion by provider identity until transaction commit."""
    if not connection.in_atomic_block:
        raise RuntimeError("Review media locks require a transaction.")
    for public_id, resource_type in sorted(set(assets)):
        identity = f"review-media:{resource_type}:{public_id}"
        lock_id = int.from_bytes(
            hashlib.sha256(identity.encode()).digest()[:8],
            byteorder="big",
            signed=True,
        )
        with connection.cursor() as cursor:
            if wait:
                cursor.execute("SELECT pg_advisory_xact_lock(%s)", [lock_id])
            else:
                cursor.execute("SELECT pg_try_advisory_xact_lock(%s)", [lock_id])
                if not cursor.fetchone()[0]:
                    return False
    return True
