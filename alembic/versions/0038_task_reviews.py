"""create task_reviews table

Revision ID: 0038_task_reviews
Revises: 0037_integration_rules
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa


revision = '0038_task_reviews'
down_revision = '0037_integration_rules'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = bind.dialect.get_table_names(bind)

    if 'task_reviews' not in existing_tables:
        op.create_table(
            'task_reviews',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('task_id', sa.Integer(), nullable=False),
            sa.Column('requested_by_user_id', sa.Integer(), nullable=False),
            sa.Column('reviewer_agent_role', sa.String(64), nullable=False),
            sa.Column('reviewer_provider', sa.String(32), nullable=True),
            sa.Column('reviewer_model', sa.String(96), nullable=True),
            sa.Column('input_snapshot', sa.Text(), nullable=True),
            sa.Column('output', sa.Text(), nullable=True),
            sa.Column('score', sa.Integer(), nullable=True),
            sa.Column('findings_count', sa.Integer(), nullable=True),
            sa.Column('severity', sa.String(16), nullable=True),
            sa.Column('status', sa.String(16), nullable=False, server_default=sa.text("'pending'")),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['task_id'], ['task_records.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ondelete='CASCADE'),
        )
        op.create_index('ix_task_reviews_org_role', 'task_reviews', ['organization_id', 'reviewer_agent_role'])
        op.create_index('ix_task_reviews_task', 'task_reviews', ['task_id'])
        op.create_index('ix_task_reviews_status', 'task_reviews', ['status'])
        op.create_index('ix_task_reviews_severity', 'task_reviews', ['severity'])


def downgrade() -> None:
    op.drop_table('task_reviews')
