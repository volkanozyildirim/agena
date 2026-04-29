"""create git_pull_request_reviews table

Persists per-(PR, reviewer) rows so the contributor analytics can
compute a real Help Others % instead of the hardcoded 0.0 stub.

Revision ID: 0035_git_pr_reviews
Revises: 0034_task_imported_from_share
Create Date: 2026-04-29
"""

from alembic import op
import sqlalchemy as sa


revision = '0035_git_pr_reviews'
down_revision = '0034_task_imported_from_share'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.dialect.get_table_names(bind)

    if 'git_pull_request_reviews' not in existing:
        op.create_table(
            'git_pull_request_reviews',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('repo_mapping_id', sa.String(64), nullable=False),
            sa.Column('pull_request_id', sa.Integer(), nullable=False),
            sa.Column('reviewer_name', sa.String(255), nullable=True),
            sa.Column('reviewer_email', sa.String(255), nullable=True),
            sa.Column('vote', sa.Integer(), nullable=False, server_default=sa.text('0')),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.UniqueConstraint(
                'organization_id', 'repo_mapping_id', 'pull_request_id', 'reviewer_email',
                name='uq_git_pr_review',
            ),
        )
        op.create_index('ix_git_pr_reviews_org', 'git_pull_request_reviews', ['organization_id'])
        op.create_index('ix_git_pr_reviews_repo', 'git_pull_request_reviews', ['repo_mapping_id'])
        op.create_index('ix_git_pr_reviews_pr', 'git_pull_request_reviews', ['pull_request_id'])
        op.create_index('ix_git_pr_reviews_email', 'git_pull_request_reviews', ['reviewer_email'])


def downgrade() -> None:
    op.drop_table('git_pull_request_reviews')
