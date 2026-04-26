"""widen agent_logs.message to MEDIUMTEXT

A single code_preview log entry can include the full generated diff
(thousands of files for large refactors). MySQL TEXT caps at 64KB,
which trips a DataError mid-pipeline and rolls back the worker's
transaction — leaving the task stuck in 'failed' with no error logs.
MEDIUMTEXT is 16MB, plenty of headroom.

Revision ID: 0031_widen_agent_logs_message
Revises: d7e4f1a8b9c2
Create Date: 2026-04-27 01:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql


revision = '0031_widen_agent_logs_message'
down_revision = 'd7e4f1a8b9c2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'agent_logs', 'message',
        existing_type=sa.Text(),
        type_=mysql.MEDIUMTEXT(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'agent_logs', 'message',
        existing_type=mysql.MEDIUMTEXT(),
        type_=sa.Text(),
        existing_nullable=False,
    )
