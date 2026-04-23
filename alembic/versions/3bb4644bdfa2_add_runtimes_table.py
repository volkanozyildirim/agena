"""add runtimes table

Revision ID: 3bb4644bdfa2
Revises: 3528e72ff789
Create Date: 2026-04-23 21:41:54.821822

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3bb4644bdfa2'
down_revision = '3528e72ff789'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'runtimes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('registered_by_user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('kind', sa.String(32), nullable=False, server_default='local'),
        sa.Column('status', sa.String(32), nullable=False, server_default='active'),
        sa.Column('description', sa.String(512), nullable=True),
        sa.Column('available_clis', sa.JSON(), nullable=True),
        sa.Column('daemon_version', sa.String(32), nullable=True),
        sa.Column('host', sa.String(256), nullable=True),
        sa.Column('auth_token_hash', sa.String(128), nullable=True),
        sa.Column('last_heartbeat_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['registered_by_user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_runtimes_organization_id', 'runtimes', ['organization_id'])
    op.create_index('ix_runtimes_name', 'runtimes', ['name'])
    op.create_index('ix_runtimes_kind', 'runtimes', ['kind'])
    op.create_index('ix_runtimes_status', 'runtimes', ['status'])
    op.create_index('ix_runtimes_last_heartbeat_at', 'runtimes', ['last_heartbeat_at'])


def downgrade() -> None:
    op.drop_index('ix_runtimes_last_heartbeat_at', table_name='runtimes')
    op.drop_index('ix_runtimes_status', table_name='runtimes')
    op.drop_index('ix_runtimes_kind', table_name='runtimes')
    op.drop_index('ix_runtimes_name', table_name='runtimes')
    op.drop_index('ix_runtimes_organization_id', table_name='runtimes')
    op.drop_table('runtimes')
