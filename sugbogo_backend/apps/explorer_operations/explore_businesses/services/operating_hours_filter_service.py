from zoneinfo import ZoneInfo

from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone

from apps.business.models import BusinessOperatingHours


def apply_open_now_filter(
    queryset,
    at=None,
):
    """Keep businesses whose stored weekly hours cover the current Cebu time."""
    local_now = timezone.localtime(
        at or timezone.now(),
        ZoneInfo("Asia/Manila"),
    )
    days = BusinessOperatingHours.Day.values
    today = days[local_now.weekday()]
    yesterday = days[(local_now.weekday() - 1) % 7]
    current_time = local_now.time()

    # An overnight shift belongs to its opening day, including Sunday -> Monday.
    today_hours = Q(
        BOHR_DAY=today,
    ) & (
        Q(
            BOHR_IS_24_HOURS=True,
        )
        | Q(
            BOHR_OPEN_TIME__lt=F("BOHR_CLOSE_TIME"),
            BOHR_OPEN_TIME__lte=current_time,
            BOHR_CLOSE_TIME__gt=current_time,
        )
        | Q(
            BOHR_OPEN_TIME__gt=F("BOHR_CLOSE_TIME"),
            BOHR_OPEN_TIME__lte=current_time,
        )
    )
    previous_overnight = Q(
        BOHR_DAY=yesterday,
        BOHR_IS_24_HOURS=False,
        BOHR_OPEN_TIME__gt=F("BOHR_CLOSE_TIME"),
        BOHR_CLOSE_TIME__gt=current_time,
    )
    open_schedule = BusinessOperatingHours.objects.filter(
        today_hours | previous_overnight,
        BUSN_ID=OuterRef("BUSN_ID"),
        BOHR_IS_OPEN=True,
    )

    # Missing/incomplete ordinary schedules never assert that a business is open.
    return queryset.annotate(
        map_is_open_now=Exists(
            open_schedule,
        ),
    ).filter(
        map_is_open_now=True,
    )
