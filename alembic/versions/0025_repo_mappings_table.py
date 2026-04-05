"""create repo_mappings table and add repo_mapping_id to task_records

Revision ID: 0025_repo_mappings_table
Revises: 6c7a8fa0425f
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa

revision = '0025_repo_mappings_table'
down_revision = '6c7a8fa0425f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.dialect.get_table_names(bind)

    if 'repo_mappings' not in existing:
        op.create_table(
            'repo_mappings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('provider', sa.String(32), nullable=False),
            sa.Column('owner', sa.String(255), nullable=False),
            sa.Column('repo_name', sa.String(255), nullable=False),
            sa.Column('base_branch', sa.String(255), nullable=False, server_default='main'),
            sa.Column('local_repo_path', sa.Text(), nullable=True),
            sa.Column('playbook', sa.Text(), nullable=True),
            sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.UniqueConstraint('organization_id', 'provider', 'owner', 'repo_name', name='uq_org_repo_mapping'),
        )
        op.create_index('ix_repo_mappings_organization_id', 'repo_mappings', ['organization_id'])
        op.create_index('ix_repo_mappings_provider', 'repo_mappings', ['provider'])

    # Add repo_mapping_id FK to task_records
    try:
        op.add_column('task_records', sa.Column('repo_mapping_id', sa.Integer(), nullable=True))
        op.create_foreign_key(
            'fk_task_records_repo_mapping',
            'task_records', 'repo_mappings',
            ['repo_mapping_id'], ['id'],
            ondelete='SET NULL',
        )
        op.create_index('ix_task_records_repo_mapping_id', 'task_records', ['repo_mapping_id'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_constraint('fk_task_records_repo_mapping', 'task_records', type_='foreignkey')
        op.drop_index('ix_task_records_repo_mapping_id', 'task_records')
        op.drop_column('task_records', 'repo_mapping_id')
    except Exception:
        pass
    op.drop_table('repo_mappings')
