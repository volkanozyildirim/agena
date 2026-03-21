"""add task dependency graph table

Revision ID: 0007_task_dependencies
Revises: 0006_repo_mappings
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = '0007_task_dependencies'
down_revision = '0006_repo_mappings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'task_dependencies',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('task_records.id', ondelete='CASCADE'), nullable=False),
        sa.Column('depends_on_task_id', sa.Integer(), sa.ForeignKey('task_records.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.UniqueConstraint('organization_id', 'task_id', 'depends_on_task_id', name='uq_task_dependency'),
    )
    op.create_index('ix_task_dependencies_organization_id', 'task_dependencies', ['organization_id'])
    op.create_index('ix_task_dependencies_task_id', 'task_dependencies', ['task_id'])
    op.create_index('ix_task_dependencies_depends_on_task_id', 'task_dependencies', ['depends_on_task_id'])


def downgrade() -> None:
    op.drop_index('ix_task_dependencies_depends_on_task_id', table_name='task_dependencies')
    op.drop_index('ix_task_dependencies_task_id', table_name='task_dependencies')
    op.drop_index('ix_task_dependencies_organization_id', table_name='task_dependencies')
    op.drop_table('task_dependencies')
