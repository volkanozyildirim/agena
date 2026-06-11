"""seed the youtrack module so it appears on /dashboard/modules

YouTrack is a first-class task source (mirrors Jira). Like the other
provider modules (azure, jira, github, …) it gets a row in `modules`
so admins can toggle it per-org. Idempotent INSERT — existing rows are
left untouched so operator overrides survive re-runs.

Revision ID: 0069_seed_youtrack_module
Revises: 0068_alert_rule_noise
Create Date: 2026-06-11
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0069_seed_youtrack_module'
down_revision = '0068_alert_rule_noise'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT 1 FROM modules WHERE slug = 'youtrack'")
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            'INSERT INTO modules '
            '(slug, name, description, icon, is_core, default_enabled, sort_order) '
            'VALUES (:slug, :name, :desc, :icon, :is_core, :enabled, :sort_order)'
        ),
        {
            'slug': 'youtrack',
            'name': 'YouTrack',
            'desc': 'Connect JetBrains YouTrack for sprint import, status sync, and AI refinement.',
            'icon': '🟪',
            'is_core': 0,
            'enabled': 1,
            'sort_order': 11,  # right after Sprints (10) / before Refinement (12), next to Jira
        },
    )


def downgrade() -> None:
    # No-op: removing a module row would orphan organization_modules.
    pass
