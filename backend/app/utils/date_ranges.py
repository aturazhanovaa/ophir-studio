from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


@dataclass(frozen=True)
class DateRange:
    start: datetime
    end: datetime


def _ensure_tz(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _start_of_day(dt: datetime) -> datetime:
    dt = _ensure_tz(dt)
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


def _end_of_day(dt: datetime) -> datetime:
    dt = _ensure_tz(dt)
    return dt.replace(hour=23, minute=59, second=59, microsecond=999_999)


def _quarter_start(year: int, quarter_index: int, tz) -> datetime:
    month = quarter_index * 3 + 1
    return datetime(year, month, 1, 0, 0, 0, 0, tzinfo=tz)


def _quarter_end(year: int, quarter_index: int, tz) -> datetime:
    # Start of next quarter minus 1 microsecond.
    if quarter_index == 3:
        next_start = _quarter_start(year + 1, 0, tz)
    else:
        next_start = _quarter_start(year, quarter_index + 1, tz)
    return next_start - timedelta(microseconds=1)


def last_quarter_range(now: datetime) -> DateRange:
    now = _ensure_tz(now)
    q = (now.month - 1) // 3
    if q == 0:
        year = now.year - 1
        q = 3
    else:
        year = now.year
        q -= 1
    tz = now.tzinfo
    return DateRange(start=_quarter_start(year, q, tz), end=_quarter_end(year, q, tz))


def this_quarter_to_date_range(now: datetime) -> DateRange:
    now = _ensure_tz(now)
    q = (now.month - 1) // 3
    tz = now.tzinfo
    return DateRange(start=_quarter_start(now.year, q, tz), end=_end_of_day(now))


def last_n_days_range(now: datetime, days: int) -> DateRange:
    if days < 1:
        raise ValueError("days must be >= 1")
    now = _ensure_tz(now)
    end = _end_of_day(now)
    start = _start_of_day(now - timedelta(days=days - 1))
    return DateRange(start=start, end=end)


def last_12_months_range(now: datetime) -> DateRange:
    now = _ensure_tz(now)
    end = _end_of_day(now)
    start = _start_of_day(now.replace(year=now.year - 1))
    return DateRange(start=start, end=end)


def parse_iso_datetime(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    return _ensure_tz(dt)


def resolve_date_range(
    *,
    range_key: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    now: Optional[datetime] = None,
) -> DateRange:
    """
    Resolves a DateRange.

    Precedence:
    1) Explicit start_date/end_date
    2) range_key preset
    3) Default: last 7 days
    """
    if now is None:
        now = datetime.now(timezone.utc)

    if start_date or end_date:
        start = parse_iso_datetime(start_date) if start_date else last_n_days_range(now, 7).start
        end = parse_iso_datetime(end_date) if end_date else _end_of_day(now)
        if start > end:
            raise ValueError("start_date must be <= end_date")
        return DateRange(start=start, end=end)

    key = (range_key or "").strip().lower()
    if key in {"7d", "last_7_days"}:
        return last_n_days_range(now, 7)
    if key in {"30d", "last_30_days"}:
        return last_n_days_range(now, 30)
    if key in {"90d", "last_90_days"}:
        return last_n_days_range(now, 90)
    if key in {"last_quarter"}:
        return last_quarter_range(now)
    if key in {"this_quarter_to_date", "this_quarter"}:
        return this_quarter_to_date_range(now)
    if key in {"last_12_months"}:
        return last_12_months_range(now)
    if not key:
        return last_n_days_range(now, 7)
    raise ValueError("Invalid range")


def to_utc_range(rng: DateRange) -> Tuple[datetime, datetime]:
    start = rng.start.astimezone(timezone.utc)
    end = rng.end.astimezone(timezone.utc)
    return start, end

