from __future__ import annotations

import enum


class RoleEnum(str, enum.Enum):
    trainer = "trainer"
    client = "client"


class UnitEnum(str, enum.Enum):
    lbs = "lbs"
    kg = "kg"


class DistanceUnitEnum(str, enum.Enum):
    inches = "in"
    cm = "cm"


class ClientStatusEnum(str, enum.Enum):
    active = "active"
    archived = "archived"


class InviteStatusEnum(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    expired = "expired"
    revoked = "revoked"


class DeliveryMethodEnum(str, enum.Enum):
    email = "email"
    sms = "sms"


class EffortTypeEnum(str, enum.Enum):
    rpe = "rpe"
    rir = "rir"


class SetStatusEnum(str, enum.Enum):
    completed = "completed"
    partial = "partial"
    skipped = "skipped"


class PrTypeEnum(str, enum.Enum):
    weight_at_reps = "weight_at_reps"
    estimated_1rm = "estimated_1rm"
    height_at_reps = "height_at_reps"


class ActivityEventTypeEnum(str, enum.Enum):
    session_logged = "session_logged"
    pr_hit = "pr_hit"
    invite_sent = "invite_sent"
    invite_accepted = "invite_accepted"
    badge_earned = "badge_earned"
    client_added = "client_added"


class ScheduledStatusEnum(str, enum.Enum):
    upcoming = "upcoming"
    completed = "completed"
    cancelled = "cancelled"


class RepeatRuleEnum(str, enum.Enum):
    weekly = "weekly"
    biweekly = "biweekly"


class NotificationTypeEnum(str, enum.Enum):
    client_inactive = "client_inactive"
    new_pr = "new_pr"
    session_reminder = "session_reminder"
    missed_workout = "missed_workout"
