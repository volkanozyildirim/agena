"""ensure every module referenced by the dashboard sidebar exists

Open-source guard rail: each time we add a new feature behind a
`module: 'xxx'` gate in `frontend/app/dashboard/layout.tsx`, we have to
remember to drop a seed-row migration for it (see 0042_seed_reviews,
0053_seed_insights, …). The `insights` row was missing for weeks
before someone noticed the page wasn't appearing. This migration
collapses that ritual into a single idempotent INSERT IGNORE so a
fresh `alembic upgrade head` is enough to make every gated feature
visible on /dashboard/modules. Existing rows are left alone so an
operator's name / description / default_enabled overrides aren't
overwritten.

Revision ID: 0054_ensure_all_modules_seeded
Revises: 0053_seed_insights_module
Create Date: 2026-05-04
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0054_ensure_all_modules_seeded'
down_revision = '0053_seed_insights_module'
branch_labels = None
depends_on = None


# Mirrors the `module:` attributes used in the sidebar nav. New entries
# here become available on a fresh install (and retroactively on
# upgrade) without needing a per-feature seed migration. Tuple shape:
# (slug, name, description, icon, is_core, default_enabled, sort_order)
_MODULES: list[tuple[str, str, str, str, int, int, int]] = [
    ('core', 'Core', 'Tasks, agents, mappings — the always-on baseline.', '⚙️', 1, 1, 1),
    ('boss_mode', 'Boss Mode', 'Pixel-art office where you manage agents visually.', '🏠', 0, 1, 5),
    ('sprints', 'Sprints & Team', 'Sprint board + team roster + history-grounded refinement.', '🗂', 0, 1, 10),
    ('refinement', 'Refinement', 'Story-point estimation grounded in past sprint outcomes.', '🔬', 0, 1, 12),
    ('triage', 'Stale Ticket Triage', 'Source-side scan of Jira / Azure for idle tickets with AI verdicts.', '🧹', 0, 0, 14),
    ('review_backlog', 'Review Backlog Killer', 'Multi-channel nudges for PRs aging past warn / critical thresholds.', '⏱', 0, 0, 16),
    ('skills', 'Skills', 'Compounding catalog of reusable patterns extracted from completed tasks.', '📚', 0, 1, 20),
    ('runtimes', 'Runtimes', 'Register laptops + cloud daemons that execute agent runs.', '💻', 0, 0, 22),
    ('reviews', 'Reviews & Reviewer Agents', 'Per-task AI code review with custom reviewer agents.', '🔎', 0, 1, 29),
    ('insights', 'Cross-Source Insights', 'Correlate PR merges + deploys + Sentry / NewRelic / Datadog / AppDynamics events into one timeline.', '🧠', 0, 0, 27),
    ('flows', 'Flows & Templates', 'Visual automation flows with n8n-style nodes + flow templates.', '🔀', 0, 1, 32),
    ('prompt_studio', 'Prompt Studio', 'Edit reviewer / planner / developer system prompts at runtime.', '✏️', 0, 1, 34),
    ('dora', 'DORA Analytics', 'Deployment frequency, lead time, change-failure rate, MTTR + sub-views.', '📊', 0, 1, 40),
    ('permissions', 'Permissions', 'Per-role permission matrix (owner / admin / member / viewer).', '🔒', 0, 1, 42),
    ('newrelic', 'New Relic', 'Pull production errors from New Relic APM entities into the task queue.', '📡', 0, 0, 50),
    ('sentry', 'Sentry', 'Auto-import Sentry issues + auto-resolve on PR merge.', '🚨', 0, 0, 52),
    ('datadog', 'Datadog', 'Pull Datadog APM errors into the task queue.', '🐶', 0, 0, 54),
    ('appdynamics', 'AppDynamics', 'Pull AppDynamics events into the task queue.', '📊', 0, 0, 56),
]


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text('SELECT slug FROM modules')).all()
    existing = {r[0] for r in rows}
    for slug, name, desc, icon, is_core, default_enabled, sort_order in _MODULES:
        if slug in existing:
            continue
        conn.execute(
            sa.text(
                'INSERT INTO modules '
                '(slug, name, description, icon, is_core, default_enabled, sort_order) '
                'VALUES (:slug, :name, :desc, :icon, :is_core, :enabled, :sort_order)'
            ),
            {
                'slug': slug, 'name': name, 'desc': desc, 'icon': icon,
                'is_core': is_core, 'enabled': default_enabled,
                'sort_order': sort_order,
            },
        )


def downgrade() -> None:
    # No-op: removing module rows would orphan organization_modules and
    # silently disable features in production. If a module needs to be
    # retired, do it through a dedicated migration that also handles
    # the data cleanup.
    pass
