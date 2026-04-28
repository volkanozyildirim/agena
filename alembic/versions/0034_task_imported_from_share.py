"""task_records.imported_from_share_id

Adds a recipient-side pointer to the share token a task was imported
from, so we can enforce one-import-per-org per share link (a single
recipient organization can only ingest a given shared task once, even
if the link still has uses left).

Revision ID: 0034_task_imported_from_share
Revises: 0033_task_share_tokens
Create Date: 2026-04-28
"""

from alembic import op
import sqlalchemy as sa


revision = '0034_task_imported_from_share'
down_revision = '0033_task_share_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c['name'] for c in sa.inspect(bind).get_columns('task_records')}
    if 'imported_from_share_id' not in cols:
        op.add_column(
            'task_records',
            sa.Column('imported_from_share_id', sa.Integer(), nullable=True),
        )
        op.create_index(
            'ix_task_records_org_share_import',
            'task_records',
            ['organization_id', 'imported_from_share_id'],
        )


def downgrade() -> None:
    op.drop_index('ix_task_records_org_share_import', table_name='task_records')
    op.drop_column('task_records', 'imported_from_share_id')
