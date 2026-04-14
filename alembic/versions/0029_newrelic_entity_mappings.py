"""create newrelic_entity_mappings table

Revision ID: 0029_nr_entity_mappings
Revises: 61e390066317
Create Date: 2026-04-14
"""

from alembic import op
import sqlalchemy as sa

revision = '0029_nr_entity_mappings'
down_revision = '61e390066317'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.dialect.get_table_names(bind)

    if 'newrelic_entity_mappings' not in existing:
        op.create_table(
            'newrelic_entity_mappings',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('entity_guid', sa.String(128), nullable=False),
            sa.Column('entity_name', sa.String(512), nullable=False),
            sa.Column('entity_type', sa.String(64), nullable=False),
            sa.Column('account_id', sa.Integer(), nullable=False),
            sa.Column('repo_mapping_id', sa.Integer(), nullable=True),
            sa.Column('flow_id', sa.String(255), nullable=True),
            sa.Column('auto_import', sa.Boolean(), nullable=False, server_default=sa.text('0')),
            sa.Column('import_interval_minutes', sa.Integer(), nullable=False, server_default=sa.text('60')),
            sa.Column('last_import_at', sa.DateTime(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['repo_mapping_id'], ['repo_mappings.id'], ondelete='SET NULL'),
            sa.UniqueConstraint('organization_id', 'entity_guid', name='uq_org_nr_entity'),
        )
        op.create_index('ix_nr_entity_mappings_org_id', 'newrelic_entity_mappings', ['organization_id'])
        op.create_index('ix_nr_entity_mappings_entity_guid', 'newrelic_entity_mappings', ['entity_guid'])
        op.create_index('ix_nr_entity_mappings_repo_mapping_id', 'newrelic_entity_mappings', ['repo_mapping_id'])


def downgrade() -> None:
    op.drop_table('newrelic_entity_mappings')
