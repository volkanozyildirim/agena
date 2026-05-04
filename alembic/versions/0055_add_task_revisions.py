"""add task_revisions table + revision_count + run_records.kind

Revision ID: 0055_add_task_revisions
Revises: 0054_ensure_all_modules_seeded
Create Date: 2026-05-04
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0055_add_task_revisions'
down_revision = '0054_ensure_all_modules_seeded'
branch_labels = None
depends_on = None


def _has_column(conn, table: str, column: str) -> bool:
    res = conn.execute(sa.text(
        'SELECT COUNT(*) FROM information_schema.columns '
        'WHERE table_name=:t AND column_name=:c'
    ), {'t': table, 'c': column}).scalar() or 0
    return int(res) > 0


def _has_table(conn, table: str) -> bool:
    res = conn.execute(sa.text(
        'SELECT COUNT(*) FROM information_schema.tables '
        'WHERE table_name=:t'
    ), {'t': table}).scalar() or 0
    return int(res) > 0


def upgrade() -> None:
    conn = op.get_bind()

    # task_revisions — one row per "fix this small thing" follow-up
    # request the user files against an already-completed task. The
    # worker re-uses the existing feature branch so the PR auto-updates.
    if not _has_table(conn, 'task_revisions'):
        op.create_table(
            'task_revisions',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('task_id', sa.Integer, sa.ForeignKey('task_records.id', ondelete='CASCADE'), nullable=False),
            sa.Column('organization_id', sa.Integer, sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('assignment_id', sa.Integer, sa.ForeignKey('task_repo_assignments.id', ondelete='SET NULL'), nullable=True),
            sa.Column('run_record_id', sa.Integer, sa.ForeignKey('run_records.id', ondelete='SET NULL'), nullable=True),
            sa.Column('requested_by_user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('instruction', sa.Text, nullable=False),
            sa.Column('status', sa.String(32), nullable=False, server_default='queued'),
            sa.Column('failure_reason', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        )
        op.create_index('ix_task_revisions_task_id', 'task_revisions', ['task_id'])
        op.create_index('ix_task_revisions_organization_id', 'task_revisions', ['organization_id'])
        op.create_index('ix_task_revisions_assignment_id', 'task_revisions', ['assignment_id'])
        op.create_index('ix_task_revisions_status', 'task_revisions', ['status'])

    # task_repo_assignments.revision_count + last_revision_id — let the
    # UI show "Revize edildi (3 kez)" without an extra COUNT() query.
    if not _has_column(conn, 'task_repo_assignments', 'revision_count'):
        op.add_column(
            'task_repo_assignments',
            sa.Column('revision_count', sa.Integer, nullable=False, server_default='0'),
        )
    if not _has_column(conn, 'task_repo_assignments', 'last_revision_id'):
        # Plain int (no FK) — see TaskRepoAssignment model comment.
        op.add_column(
            'task_repo_assignments',
            sa.Column('last_revision_id', sa.Integer, nullable=True),
        )

    # run_records.kind — 'initial' for the first end-to-end run on a
    # task, 'revision' for subsequent commits added to the same branch
    # via /tasks/{id}/revise. Drives run-tab labelling on the frontend.
    if not _has_column(conn, 'run_records', 'kind'):
        op.add_column(
            'run_records',
            sa.Column('kind', sa.String(16), nullable=False, server_default='initial'),
        )


def downgrade() -> None:
    # Removing this stuff would orphan in-flight revision rows and
    # confuse the worker. If a forward-only rollback is needed, run a
    # data-cleanup migration first.
    pass
