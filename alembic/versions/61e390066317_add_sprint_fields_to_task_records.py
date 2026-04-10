"""add sprint fields to task_records

Revision ID: 61e390066317
Revises: 0028_integration_extra
Create Date: 2026-04-10 19:58:49.101763

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '61e390066317'
down_revision = '0028_integration_extra'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('task_records', sa.Column('sprint_name', sa.String(255), nullable=True))
    op.add_column('task_records', sa.Column('sprint_path', sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column('task_records', 'sprint_path')
    op.drop_column('task_records', 'sprint_name')
