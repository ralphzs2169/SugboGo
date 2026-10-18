"""Build bounded deterministic analytics fixtures without reading or writing databases."""

import random
from datetime import UTC, datetime, time, timedelta

from apps.shared.analytics.date_ranges import MANILA


DATASET_VERSION = 1
ACTOR_COUNT = 48
BANDS = (
    (0, 6, 84, 30, 6, 6, 3, 9),
    (7, 29, 150, 55, 10, 8, 5, 12),
    (30, 59, 130, 45, 8, 8, 6, 9),
    (60, 89, 96, 35, 6, 8, 5, 6),
)
SENTIMENTS = (
    ("positive", "positive", "neutral", "negative", None, "positive"),
    ("positive", "neutral", "positive", "negative", "positive", None, "positive", "positive"),
    ("positive", "negative", "positive", "neutral", "positive", "negative", "positive", "positive"),
    ("positive", "neutral", "positive", "negative", "positive", None, "positive", "positive"),
)


def parse_timestamp(value):
    """Restore an aware persisted timestamp without relying on the host timezone."""
    return datetime.fromisoformat(value).astimezone(UTC)


def observation_identity(
    event_type,
    actor,
    occurred_at,
):
    """Keep fixture observations unique per event, account and UTC day."""
    return event_type, actor, occurred_at.astimezone(UTC).date().isoformat()


def _slots(
    anchor,
    first,
    last,
    earliest,
):
    """Offer elapsed Manila hours only after the applicable business/link creation."""
    today = anchor.astimezone(MANILA).date()
    result = []
    eligible_days = set()
    for offset in range(first, last + 1):
        day = today - timedelta(days=offset)
        for hour in (1, 8, 10, 12, 15, 18, 20, 22):
            stamp = datetime.combine(
                day,
                time(hour, (offset * 7 + hour) % 60),
                tzinfo=MANILA,
            ).astimezone(UTC)
            if earliest <= stamp < anchor:
                eligible_days.add(day)
                # Quiet fixture days remain gaps rather than explicit zero documents.
                if offset % 13 != 4:
                    weight = 3 if day.weekday() in (4, 5) else 1
                    result.extend([stamp] * weight)
    return result, len(eligible_days)


def _band_count(
    requested,
    eligible_days,
    first,
    last,
):
    """Reduce young-business quantities instead of compressing 90 days into a few days."""
    return round(requested * eligible_days / (last - first + 1))


def build_dataset(
    context,
    anchor,
    baseline,
):
    """Plan one target's synthetic contribution with stable keys and no external side effects."""
    namespace = f"merchant-analytics-b{context['business_id']}-v{DATASET_VERSION}"
    earliest = parse_timestamp(context["created_at"])
    events = []
    reviews = []
    replies = []
    vouches = []
    seen_events = set()
    seen_vouches = set()
    review_number = 0
    for band, values in enumerate(BANDS):
        first = values[0]
        last = values[1]
        impressions = values[2]
        visits = values[3]
        saves = values[4]
        review_count = values[5]
        reply_count = values[6]
        vouch_count = values[7]
        slots, days = _slots(
            anchor,
            first,
            last,
            earliest,
        )
        for kind, requested in (
            ("IMPRESSION", impressions),
            ("PROFILE_VISIT", visits),
            ("SAVE", saves),
        ):
            randomizer = random.Random(f"{namespace}:{kind}:{band}")
            wanted = _band_count(requested, days, first, last)
            added = 0
            for attempt in range(wanted * 100):
                if not slots or added >= wanted:
                    break
                stamp = randomizer.choice(slots)
                pool = 20 if kind == "SAVE" else ACTOR_COUNT
                actor = (attempt * 7 + band * 3) % pool
                identity = observation_identity(kind, actor, stamp)
                if identity in seen_events:
                    continue
                seen_events.add(identity)
                events.append({
                    "type": kind,
                    "actor": actor,
                    "at": stamp.isoformat(),
                })
                added += 1
        wanted_reviews = _band_count(review_count, days, first, last)
        ordered_slots = sorted(set(slots))
        for index in range(wanted_reviews):
            if not ordered_slots:
                break
            stamp = ordered_slots[index * len(ordered_slots) // wanted_reviews]
            label = SENTIMENTS[band][index]
            wording = {
                "positive": "Friendly service and an enjoyable experience.",
                "neutral": "A straightforward experience with the listed offerings.",
                "negative": "The wait was longer than expected during this demo visit.",
                None: "A recent experience awaiting sentiment classification.",
            }[label]
            review = {
                "key": f"review-{review_number}",
                "actor": review_number,
                "at": stamp.isoformat(),
                "text": f"[DEMO {namespace} {review_number}] {wording}",
                "sentiment": label,
                "score": {"positive": 0.6, "neutral": 0.0, "negative": -0.6, None: None}[label],
            }
            reviews.append(review)
            if index < min(reply_count, wanted_reviews):
                delay = timedelta(hours=(2, 8, 24, 48, 72)[index % 5])
                reply_at = min(stamp + delay, anchor - timedelta(seconds=1))
                if reply_at >= stamp:
                    replies.append({
                        "review": review["key"],
                        "at": reply_at.isoformat(),
                        "text": f"[DEMO {namespace}] Thank you for sharing your feedback.",
                    })
            review_number += 1
        links = context["specialties"][:3]
        for index in range(vouch_count):
            if not links:
                break
            ordinal = sum(row[7] for row in BANDS[:band]) + index
            pool = ACTOR_COUNT if len(links) == 1 else 24
            pattern = (0, 0, 0, 0, 1, 2)
            tag_index = (pattern[ordinal % len(pattern)] + ordinal // pool) % len(links)
            link = links[tag_index]
            link_start = max(
                earliest,
                parse_timestamp(link["created_at"]),
                parse_timestamp(link["activated_at"]),
            )
            tag_slots, tag_days = _slots(
                anchor,
                first,
                last,
                link_start,
            )
            allowed = _band_count(vouch_count, tag_days, first, last)
            if not tag_slots or index >= allowed:
                continue
            actor = ordinal % pool
            identity = (actor, link["tag_id"])
            if identity in seen_vouches:
                continue
            seen_vouches.add(identity)
            stamp = tag_slots[(index * 17 + band * 11) % len(tag_slots)]
            vouches.append({
                "actor": actor,
                "tag_id": link["tag_id"],
                "at": stamp.isoformat(),
            })
    events.sort(key=lambda row: (row["at"], row["type"], row["actor"]))
    saved = {}
    for event in events:
        if event["type"] == "SAVE":
            saved.setdefault(event["actor"], event["at"])
    pockets = [
        {"actor": actor, "at": stamp}
        for actor, stamp in sorted(saved.items())[:14]
    ]
    actors = {
        row["actor"]
        for group in (events, reviews, vouches, pockets)
        for row in group
    }
    return {
        "namespace": namespace,
        "anchor": anchor.isoformat(),
        "baseline": str(baseline),
        "actors": sorted(actors),
        "reviews": reviews,
        "replies": replies,
        "pockets": pockets,
        "vouches": vouches,
        "events": events,
    }
