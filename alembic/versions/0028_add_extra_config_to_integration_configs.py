"""add extra_config to integration_configs

Revision ID: 0028_add_extra_config_to_integration_configs
Revises: f0cb9f7a0e30
Create Date: 2026-04-07

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0028_integration_extra'
down_revision = '0027_refinement_prompts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_name='integration_configs' AND column_name='extra_config'"
    ))
    if result.scalar():
        return
    op.add_column('integration_configs', sa.Column('extra_config', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('integration_configs', 'extra_config')
