from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from agena_core.db.base import Base


class NewRelicEntityMapping(Base):
    """Maps a New Relic entity to an Agena repo mapping for auto-import."""
    __tablename__ = 'newrelic_entity_mappings'
    __table_args__ = (
        UniqueConstraint('organization_id', 'entity_guid', name='uq_org_nr_entity'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey('organizations.id', ondelete='CASCADE'), index=True)
    entity_guid: Mapped[str] = mapped_column(String(128), index=True)
    entity_name: Mapped[str] = mapped_column(String(512))
    entity_type: Mapped[str] = mapped_column(String(64))
    account_id: Mapped[int] = mapped_column(Integer)
    repo_mapping_id: Mapped[int | None] = mapped_column(ForeignKey('repo_mappings.id', ondelete='SET NULL'), nullable=True, index=True)
    flow_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auto_import: Mapped[bool] = mapped_column(Boolean, default=False)
    import_interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    last_import_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
