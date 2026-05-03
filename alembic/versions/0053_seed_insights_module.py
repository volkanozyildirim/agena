"""seed insights module (default OFF)

The /dashboard/insights page + the cross-source correlation poller in
the worker were always shipped behind a `module: 'insights'` gate, but
no row was ever inserted into the `modules` table — so the sidebar
hid the page on every tenant and there was no toggle on /modules to
turn it on. This migration adds the row so admins can enable it.

Default OFF so existing tenants don't suddenly start polling Sentry /
NewRelic / Datadog / AppDynamics + git_pull_requests for correlations
without an explicit opt-in.

Revision ID: 0053_seed_insights_module
Revises: 0052_pr_is_draft
Create Date: 2026-05-04
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = '0053_seed_insights_module'
down_revision = '0052_pr_is_draft'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = conn.execute(
        sa.text("SELECT id FROM modules WHERE slug = 'insights'")
    ).scalar_one_or_none()
    if existing:
        return
    conn.execute(sa.text(
        "INSERT INTO modules (slug, name, description, icon, is_core, default_enabled, sort_order) "
        "VALUES ('insights', 'Cross-Source Insights', "
        "'Correlates PR merges + deploys + Sentry / NewRelic / Datadog / AppDynamics / Jira / Azure events into one timeline. "
        "Confidence-scored clusters surface on /dashboard/insights with one-click rollback PR.', "
        "'🧠', 0, 0, 27)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM modules WHERE slug = 'insights'"))
    conn.execute(sa.text("DELETE FROM organization_modules WHERE module_slug = 'insights'"))
