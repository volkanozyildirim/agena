from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from agena_core.db.base import Base


class RefinementJob(Base):
    """Tracks an in-flight or completed refinement analyze run.

    Allows the frontend to recover state across page navigations / refreshes
    by polling /refinement/jobs/{id} after the page reloads.
    """

    __tablename__ = 'refinement_jobs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey('organizations.id', ondelete='CASCADE'), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)

    # 'queued' | 'running' | 'completed' | 'failed'
    status: Mapped[str] = mapped_column(String(16), default='queued', index=True)

    # Used by the frontend to key localStorage entries to a sprint/provider so
    # we can resume the right job when the user navigates back.
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    sprint_ref: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)

    # Snapshot of the original analyze payload (for retry / debugging).
    payload: Mapped[dict] = mapped_column(JSON)

    # Final result on completed; null while running.
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
