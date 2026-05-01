"""add correlations table for cross-source insights

Revision ID: 0039_correlations
Revises: 0038_task_reviews
Create Date: 2026-05-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0039_correlations'
down_revision = '0038_task_reviews'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_name='correlations'"
    ))
    if result.scalar():
        return

    op.create_table(
        'correlations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('window_start', sa.DateTime(), nullable=False),
        sa.Column('window_end', sa.DateTime(), nullable=False),
        sa.Column('primary_kind', sa.String(length=32), nullable=False),
        sa.Column('primary_ref', sa.String(length=255), nullable=False),
        sa.Column('primary_label', sa.String(length=512), nullable=False),
        sa.Column('related_events', sa.JSON(), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('severity', sa.String(length=16), nullable=True),
        sa.Column('narrative', sa.Text(), nullable=True),
        sa.Column('repo_mapping_id', sa.String(length=64), nullable=True),
        sa.Column('fingerprint', sa.String(length=64), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_verdict', sa.String(length=16), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_correlations_organization_id', 'correlations', ['organization_id'])
    op.create_index('ix_correlations_window_start', 'correlations', ['window_start'])
    op.create_index('ix_correlations_repo_mapping_id', 'correlations', ['repo_mapping_id'])
    op.create_unique_constraint('uq_correlations_fingerprint', 'correlations', ['fingerprint'])


def downgrade() -> None:
    op.drop_constraint('uq_correlations_fingerprint', 'correlations', type_='unique')
    op.drop_index('ix_correlations_repo_mapping_id', table_name='correlations')
    op.drop_index('ix_correlations_window_start', table_name='correlations')
    op.drop_index('ix_correlations_organization_id', table_name='correlations')
    op.drop_table('correlations')
