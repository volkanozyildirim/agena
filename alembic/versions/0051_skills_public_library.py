"""extend skills for the public library: is_public, is_active, source, external_url, nullable org_id

Revision ID: 0051_skills_public_library
Revises: 0050_backlog_auto_nudge
Create Date: 2026-05-03 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0051_skills_public_library'
down_revision = '0050_backlog_auto_nudge'
branch_labels = None
depends_on = None


def _has_column(conn, table: str, col: str) -> bool:
    return bool(conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {'t': table, 'c': col}).scalar())


def upgrade() -> None:
    conn = op.get_bind()

    if not _has_column(conn, 'skills', 'is_public'):
        op.add_column('skills', sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    if not _has_column(conn, 'skills', 'is_active'):
        op.add_column('skills', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')))
    if not _has_column(conn, 'skills', 'source'):
        # 'manual' (user-created), 'extracted' (pulled from a completed task),
        # 'public_import' (imported from awesome-agent-skills / anthropics/skills / etc.)
        op.add_column('skills', sa.Column('source', sa.String(length=32), nullable=False, server_default=sa.text("'manual'")))
    if not _has_column(conn, 'skills', 'external_url'):
        # Source SKILL.md URL when imported from a public registry. Lets the UI
        # link back to the canonical version and helps the importer dedupe.
        op.add_column('skills', sa.Column('external_url', sa.String(length=512), nullable=True))
    if not _has_column(conn, 'skills', 'publisher'):
        # GitHub-style "owner/repo" of the source so the catalog UI can group
        # skills by Anthropic / Vercel / Stripe / etc.
        op.add_column('skills', sa.Column('publisher', sa.String(length=128), nullable=True))

    # organization_id was NOT NULL — public skills need NULL to mean
    # "available globally". Drop the NOT NULL constraint while keeping the FK.
    conn.execute(sa.text(
        "ALTER TABLE skills MODIFY COLUMN organization_id INT NULL"
    ))

    # Index public + active for fast retrieval at agent runtime
    op.create_index('ix_skills_public_active', 'skills', ['is_public', 'is_active'])
    # Unique on external_url so importer is idempotent
    op.execute(
        "CREATE UNIQUE INDEX uq_skills_external_url ON skills (external_url) "
        "WHERE external_url IS NOT NULL"
    ) if conn.dialect.name != 'mysql' else op.create_unique_constraint(
        'uq_skills_external_url', 'skills', ['external_url']
    )


def downgrade() -> None:
    op.drop_constraint('uq_skills_external_url', 'skills', type_='unique')
    op.drop_index('ix_skills_public_active', table_name='skills')
    op.drop_column('skills', 'publisher')
    op.drop_column('skills', 'external_url')
    op.drop_column('skills', 'source')
    op.drop_column('skills', 'is_active')
    op.drop_column('skills', 'is_public')
    op.execute("ALTER TABLE skills MODIFY COLUMN organization_id INT NOT NULL")
