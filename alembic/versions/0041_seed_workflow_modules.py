"""seed triage + review_backlog modules (default off)

Revision ID: 0041_seed_workflow_modules
Revises: 0040_triage_and_review_backlog
Create Date: 2026-05-02 00:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0041_seed_workflow_modules'
down_revision = '0040_triage_and_review_backlog'
branch_labels = None
depends_on = None


MODULES = [
    {
        'slug': 'triage',
        'name': 'Stale Ticket Triage',
        'description': 'Weekly auto-scan of stale Jira / Azure tickets with AI verdicts (close / snooze / keep) — bulk approve to apply.',
        'icon': '🧹',
        'sort_order': 27,
    },
    {
        'slug': 'review_backlog',
        'name': 'Review Backlog Killer',
        'description': 'Detects PRs sitting unreviewed past a threshold and nudges reviewers automatically (Slack DM / email).',
        'icon': '⏱',
        'sort_order': 28,
    },
]


def upgrade() -> None:
    conn = op.get_bind()
    for mod in MODULES:
        existing = conn.execute(
            sa.text('SELECT id FROM modules WHERE slug = :slug'),
            {'slug': mod['slug']},
        ).scalar_one_or_none()
        if existing:
            continue
        conn.execute(
            sa.text(
                'INSERT INTO modules (slug, name, description, icon, is_core, default_enabled, sort_order) '
                'VALUES (:slug, :name, :description, :icon, 0, 0, :sort_order)'
            ),
            mod,
        )


def downgrade() -> None:
    conn = op.get_bind()
    for mod in MODULES:
        conn.execute(
            sa.text('DELETE FROM modules WHERE slug = :slug'),
            {'slug': mod['slug']},
        )
        conn.execute(
            sa.text('DELETE FROM organization_modules WHERE module_slug = :slug'),
            {'slug': mod['slug']},
        )
