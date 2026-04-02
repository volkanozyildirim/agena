"""create prompt_overrides table

Revision ID: 0024_prompt_overrides
Revises: 0023_prompts_table
Create Date: 2026-04-02 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0024_prompt_overrides'
down_revision = '0023_prompts_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_name='prompt_overrides'"
        )
    )
    if result.scalar():
        return

    op.create_table(
        'prompt_overrides',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('prompt_key', sa.String(length=128), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'prompt_key', name='uq_prompt_overrides_user_key'),
    )
    op.create_index('ix_prompt_overrides_user_id', 'prompt_overrides', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_prompt_overrides_user_id', table_name='prompt_overrides')
    op.drop_table('prompt_overrides')
