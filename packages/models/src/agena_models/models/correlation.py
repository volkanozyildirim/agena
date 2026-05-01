"""Cross-source signal correlation. The CorrelationService periodically
clusters near-in-time events from disparate sources (PR merges, Sentry,
NewRelic, Datadog, AppDynamics, Jira, Azure work items, deploys) and
stores any cluster whose confidence ≥ threshold here. The Insights page
reads from this table — UI does no math of its own."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agena_core.db.base import Base


class Correlation(Base):
    __tablename__ = 'correlations'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True,
    )

    # Window the cluster spans
    window_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    window_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Highest-severity event becomes the "primary"; the rest live in related_events JSON
    primary_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    primary_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_label: Mapped[str] = mapped_column(String(512), nullable=False)

    # JSON list of {kind, ref, label, timestamp, url?}
    related_events: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 0-100. Stored signed for compositing; UI shows ≥70 only by default
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    severity: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # LLM-written single-sentence narrative tying the events together
    narrative: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Repo / service the cluster is anchored on (helps the UI group)
    repo_mapping_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    # Idempotency key — prevents the poller from re-creating the same cluster
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    # User feedback so we can tune thresholds later
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    acknowledged_by_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )
    user_verdict: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    organization = relationship('Organization')
    acknowledged_by = relationship('User', foreign_keys=[acknowledged_by_user_id])
