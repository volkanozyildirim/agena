from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from agena_core.db.base import Base


class Runtime(Base):
    """A compute environment that can execute agent tasks.

    Can be:
      - 'local' — the host's CLI bridge (claude/codex CLIs in your PATH),
        auto-registered when bridge-server.mjs starts.
      - 'cloud' — a remote daemon running on an AWS/GCP instance (future),
        registered manually via the dashboard.

    Each runtime reports which agent CLIs it has available, so when a task
    is assigned the orchestrator knows where to route it.
    """

    __tablename__ = 'runtimes'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey('organizations.id', ondelete='CASCADE'), index=True
    )
    registered_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )

    # Human-readable, shown in the UI (e.g. "ali's mac", "prod-runtime-01").
    name: Mapped[str] = mapped_column(String(128), index=True)
    # 'local' | 'cloud' — used to pick routing defaults.
    kind: Mapped[str] = mapped_column(String(32), default='local', index=True)
    # 'active' | 'offline' | 'disabled'
    status: Mapped[str] = mapped_column(String(32), default='active', index=True)
    # Free-form description — host label, region, team, etc.
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # JSON list of CLI slugs the daemon reports as available
    # (e.g. ['claude', 'codex', 'gemini']). Populated on heartbeat.
    available_clis: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Daemon version string so we can gate features by client version.
    daemon_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Daemon host/IP hint for debugging. Not used for routing.
    host: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # SHA-256 of the auth token handed out on register. Daemons authenticate
    # subsequent heartbeat / task-pull calls with the raw token; we compare
    # the hash here. Null for runtimes without a daemon (e.g. a record used
    # purely for UI grouping).
    auth_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Heartbeat bookkeeping. `last_heartbeat_at` is the freshness signal the
    # UI displays; `status` is recomputed from it by the service.
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
