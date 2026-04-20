"""add occurrences and last_seen_at to task_records

Revision ID: a1b2c3d4e5f6
Revises: e3d213530186
Create Date: 2026-04-20 20:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'e3d213530186'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = [r[0] for r in conn.execute(sa.text("SHOW COLUMNS FROM task_records")).fetchall()]
    if 'occurrences' not in existing:
        op.add_column('task_records', sa.Column('occurrences', sa.Integer, nullable=True))
    if 'last_seen_at' not in existing:
        op.add_column('task_records', sa.Column('last_seen_at', sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column('task_records', 'last_seen_at')
    op.drop_column('task_records', 'occurrences')
