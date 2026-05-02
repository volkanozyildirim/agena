"""triage_decisions: nullable task_id + ticket_url

Source-side triage scans Jira / Azure directly via REST instead of
limiting itself to tickets already imported into task_records. Most
returned tickets won't have a local TaskRecord, so task_id becomes
nullable. We also stash the human-friendly ticket URL so the UI can
deep-link to the source ticket.

Revision ID: 0045_triage_source_side
Revises: 0044_nudge_comment_lang
Create Date: 2026-05-02
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0045_triage_source_side'
down_revision = '0044_nudge_comment_lang'
branch_labels = None
depends_on = None


def _column_exists(bind, table: str, column: str) -> bool:
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return False
    return any(c['name'] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    # Make task_id nullable so source-side decisions (no local
    # TaskRecord) can be persisted.
    op.alter_column(
        'triage_decisions',
        'task_id',
        existing_type=sa.Integer(),
        nullable=True,
    )
    if not _column_exists(bind, 'triage_decisions', 'ticket_url'):
        op.add_column(
            'triage_decisions',
            sa.Column('ticket_url', sa.String(length=512), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, 'triage_decisions', 'ticket_url'):
        op.drop_column('triage_decisions', 'ticket_url')
    # Don't flip task_id back to NOT NULL — older rows from source-
    # side scans would block the migration. Leave as nullable on
    # downgrade; functional behaviour unchanged.
