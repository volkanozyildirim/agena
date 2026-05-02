"""add triage_decisions and review_backlog_nudges tables

Revision ID: 0040_triage_and_review_backlog
Revises: 0039_correlations
Create Date: 2026-05-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0040_triage_and_review_backlog'
down_revision = '0039_correlations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # triage_decisions — stale-ticket auto-triage (Jira / Azure)
    has_triage = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='triage_decisions'"
    )).scalar()
    if not has_triage:
        op.create_table(
            'triage_decisions',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('task_id', sa.Integer(), sa.ForeignKey('task_records.id', ondelete='CASCADE'), nullable=False),
            sa.Column('source', sa.String(length=32), nullable=False),
            sa.Column('external_id', sa.String(length=128), nullable=False),
            sa.Column('ticket_title', sa.String(length=512), nullable=True),
            sa.Column('idle_days', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('ai_verdict', sa.String(length=32), nullable=True),  # close / snooze / keep
            sa.Column('ai_confidence', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('ai_reasoning', sa.Text(), nullable=True),
            sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),  # pending/applied/skipped/overridden
            sa.Column('applied_verdict', sa.String(length=32), nullable=True),
            sa.Column('applied_at', sa.DateTime(), nullable=True),
            sa.Column('applied_by_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('ix_triage_decisions_org', 'triage_decisions', ['organization_id'])
        op.create_index('ix_triage_decisions_status', 'triage_decisions', ['status'])
        op.create_unique_constraint('uq_triage_org_task', 'triage_decisions', ['organization_id', 'task_id'])

    # review_backlog_nudges — PR review backlog killer
    has_nudges = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='review_backlog_nudges'"
    )).scalar()
    if not has_nudges:
        op.create_table(
            'review_backlog_nudges',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('pr_id', sa.Integer(), sa.ForeignKey('git_pull_requests.id', ondelete='CASCADE'), nullable=False),
            sa.Column('repo_mapping_id', sa.String(length=64), nullable=True),
            sa.Column('age_hours', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('severity', sa.String(length=16), nullable=True),  # info/warning/critical
            sa.Column('nudge_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('last_nudged_at', sa.DateTime(), nullable=True),
            sa.Column('last_nudge_channel', sa.String(length=32), nullable=True),
            sa.Column('escalated_at', sa.DateTime(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index('ix_review_backlog_org', 'review_backlog_nudges', ['organization_id'])
        op.create_unique_constraint('uq_review_backlog_pr', 'review_backlog_nudges', ['organization_id', 'pr_id'])

    # Per-org settings — stored as JSON column on organizations or a separate
    # key-value table. Reuse a generic settings table if it exists; otherwise
    # tack columns onto organizations.
    has_settings = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='org_workflow_settings'"
    )).scalar()
    if not has_settings:
        op.create_table(
            'org_workflow_settings',
            sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True),
            # Triage
            sa.Column('triage_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('triage_idle_days', sa.Integer(), nullable=False, server_default='30'),
            sa.Column('triage_schedule_cron', sa.String(length=64), nullable=False, server_default='0 18 * * 0'),  # Sunday 18:00 UTC
            sa.Column('triage_sources', sa.String(length=128), nullable=False, server_default='jira,azure_devops'),
            # Backlog
            sa.Column('backlog_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('backlog_warn_hours', sa.Integer(), nullable=False, server_default='24'),
            sa.Column('backlog_critical_hours', sa.Integer(), nullable=False, server_default='48'),
            sa.Column('backlog_nudge_interval_hours', sa.Integer(), nullable=False, server_default='6'),
            sa.Column('backlog_channel', sa.String(length=64), nullable=False, server_default='slack_dm'),
            sa.Column('backlog_exempt_repos', sa.Text(), nullable=True),  # comma-separated repo_mapping_ids
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('org_workflow_settings')
    op.drop_constraint('uq_review_backlog_pr', 'review_backlog_nudges', type_='unique')
    op.drop_index('ix_review_backlog_org', table_name='review_backlog_nudges')
    op.drop_table('review_backlog_nudges')
    op.drop_constraint('uq_triage_org_task', 'triage_decisions', type_='unique')
    op.drop_index('ix_triage_decisions_status', table_name='triage_decisions')
    op.drop_index('ix_triage_decisions_org', table_name='triage_decisions')
    op.drop_table('triage_decisions')
