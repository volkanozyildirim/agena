"""seed reviews module (default ON — preserves existing tenants)

Revision ID: 0042_seed_reviews_module
Revises: 0041_seed_workflow_modules
Create Date: 2026-05-02 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '0042_seed_reviews_module'
down_revision = '0041_seed_workflow_modules'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing = conn.execute(
        sa.text("SELECT id FROM modules WHERE slug = 'reviews'")
    ).scalar_one_or_none()
    if existing:
        return
    # default_enabled=1 because reviewer agents + 🔎 Review buttons are
    # already in active use; we don't want existing tenants to suddenly
    # lose the feature when this module is introduced.
    conn.execute(sa.text(
        "INSERT INTO modules (slug, name, description, icon, is_core, default_enabled, sort_order) "
        "VALUES ('reviews', 'Reviews & Reviewer Agents', "
        "'Per-task AI code review with custom reviewer agents (security_developer / qa / lead_developer / etc), is_reviewer toggle on agents, and per-agent review history.', "
        "'🔎', 0, 1, 29)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM modules WHERE slug = 'reviews'"))
    conn.execute(sa.text("DELETE FROM organization_modules WHERE module_slug = 'reviews'"))
