from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from agena_core.db.base import Base


class TaskRevision(Base):
    """A "revise this task" request — small follow-up instruction the
    user adds AFTER an initial run completed. The worker re-checks-out
    the assignment's existing feature branch (not main) and pushes an
    additional commit so the open PR auto-updates instead of opening a
    fresh PR for what is essentially a code-review nit.

    Status transitions:
        queued → running → completed
                       └→ failed
        queued → skipped_merged   (PR was already merged, nothing to
                                   amend; user gets a friendly "open a
                                   new task instead" hint)
    """
    __tablename__ = 'task_revisions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        ForeignKey('task_records.id', ondelete='CASCADE'), index=True,
    )
    organization_id: Mapped[int] = mapped_column(
        ForeignKey('organizations.id', ondelete='CASCADE'), index=True,
    )
    # Which assignment (repo) this revision targets. Nullable because a
    # single-repo task historically didn't fan out to assignments — we
    # still want to allow revising it.
    assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey('task_repo_assignments.id', ondelete='SET NULL'),
        nullable=True, index=True,
    )
    # Filled in once the worker starts the revision run so the UI can
    # link the row to its log/diff tab.
    run_record_id: Mapped[int | None] = mapped_column(
        ForeignKey('run_records.id', ondelete='SET NULL'), nullable=True,
    )
    requested_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )
    instruction: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default='queued', index=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(),
    )
