"""ReviewBacklogNudge — one row per PR that's been sitting unreviewed
past the warn threshold. The poller updates `age_hours` and `nudge_count`
each cycle; once the PR finally gets reviewed/merged we set
`resolved_at`."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agena_core.db.base import Base


class ReviewBacklogNudge(Base):
    __tablename__ = 'review_backlog_nudges'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True,
    )
    pr_id: Mapped[int] = mapped_column(
        ForeignKey('git_pull_requests.id', ondelete='CASCADE'), nullable=False,
    )
    repo_mapping_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    age_hours: Mapped[int] = mapped_column(Integer, default=0)
    severity: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    nudge_count: Mapped[int] = mapped_column(Integer, default=0)
    last_nudged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_nudge_channel: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    escalated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    organization = relationship('Organization')
    pr = relationship('GitPullRequest')
