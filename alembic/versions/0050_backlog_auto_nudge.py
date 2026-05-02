"""org_workflow_settings: add backlog_auto_nudge

Explicit opt-in toggle for the worker's auto-nudge poller. Channel
selection (Slack / PR comment / email / WhatsApp / …) is now purely
about *where* a nudge goes; this flag decides *whether* the worker
fires nudges on its own without a button click. Defaults to False so
existing tenants keep their current "manual only" behaviour unless
they explicitly turn auto-nudge on.

Revision ID: 0050_backlog_auto_nudge
Revises: 0049_triage_max_age_days
Create Date: 2026-05-03
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0050_backlog_auto_nudge'
down_revision = '0049_triage_max_age_days'
branch_labels = None
depends_on = None


def _column_exists(bind, table: str, column: str) -> bool:
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return False
    return any(c['name'] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _column_exists(bind, 'org_workflow_settings', 'backlog_auto_nudge'):
        op.add_column(
            'org_workflow_settings',
            sa.Column(
                'backlog_auto_nudge',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('0'),
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _column_exists(bind, 'org_workflow_settings', 'backlog_auto_nudge'):
        op.drop_column('org_workflow_settings', 'backlog_auto_nudge')
