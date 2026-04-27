"""create refinement_jobs table

Tracks in-flight refinement analyze runs so the UI can resume the
"running" state across page navigations / refreshes by polling for the
job's outcome instead of relying on a synchronous fetch that dies when
the user leaves the page.

Revision ID: 0032_refinement_jobs
Revises: 0031_widen_agent_logs_message
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa


revision = '0032_refinement_jobs'
down_revision = '0031_widen_agent_logs_message'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.dialect.get_table_names(bind)

    if 'refinement_jobs' not in existing:
        op.create_table(
            'refinement_jobs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(16), nullable=False, server_default='queued'),
            sa.Column('provider', sa.String(32), nullable=True),
            sa.Column('sprint_ref', sa.String(512), nullable=True),
            sa.Column('payload', sa.JSON(), nullable=False),
            sa.Column('result', sa.JSON(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        )
        op.create_index('ix_refinement_jobs_org_status', 'refinement_jobs', ['organization_id', 'status'])
        op.create_index('ix_refinement_jobs_user_status', 'refinement_jobs', ['user_id', 'status'])
        op.create_index('ix_refinement_jobs_sprint', 'refinement_jobs', ['organization_id', 'provider', 'sprint_ref'])
        op.create_index('ix_refinement_jobs_created', 'refinement_jobs', ['created_at'])


def downgrade() -> None:
    op.drop_table('refinement_jobs')
