"""Add avatar_looks table and update avatar_scenarios table

Revision ID: 003_looks_and_prep
Revises: 002_scenarios_voices
Create Date: 2026-08-13 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '003_looks_and_prep'
down_revision: Union[str, Sequence[str], None] = '002_scenarios_voices'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create pb_look_id_seq PostgreSQL sequence
    op.execute("CREATE SEQUENCE IF NOT EXISTS pb_look_id_seq START WITH 1")

    # 2. Create avatar_looks table
    op.create_table(
        'avatar_looks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('look_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('preview_image_url', sa.String(length=500), nullable=True),
        sa.Column('clothing_style', sa.String(length=100), nullable=True),
        sa.Column('background_type', sa.String(length=50), nullable=True),
        sa.Column('background_value', sa.String(length=500), nullable=True),
        sa.Column('lighting_style', sa.String(length=100), nullable=True),
        sa.Column('camera_framing', sa.String(length=100), nullable=True),
        sa.Column('body_position', sa.String(length=100), nullable=True),
        sa.Column('subject_position', sa.String(length=100), nullable=True),
        sa.Column('scale', sa.String(length=50), nullable=True),
        sa.Column('crop_style', sa.String(length=100), nullable=True),
        sa.Column('aspect_ratio', sa.String(length=50), nullable=True),
        sa.Column('transformation_prompt', sa.Text(), nullable=True),
        sa.Column('negative_prompt', sa.Text(), nullable=True),
        sa.Column('provider_config_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_avatar_looks_look_id'), 'avatar_looks', ['look_id'], unique=True)

    # 3. Add look_id, original_photo_url, prepared_photo_url, creation_status, creation_error to avatar_scenarios
    op.add_column('avatar_scenarios', sa.Column('look_id', sa.String(length=36), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('original_photo_url', sa.String(length=500), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('prepared_photo_url', sa.String(length=500), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('creation_status', sa.String(length=50), nullable=False, server_default='DRAFT'))
    op.add_column('avatar_scenarios', sa.Column('creation_error', sa.Text(), nullable=True))
    
    op.create_foreign_key('fk_avatar_scenarios_look_id', 'avatar_scenarios', 'avatar_looks', ['look_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_avatar_scenarios_look_id'), 'avatar_scenarios', ['look_id'], unique=False)
    op.create_index(op.f('ix_avatar_scenarios_creation_status'), 'avatar_scenarios', ['creation_status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_avatar_scenarios_creation_status'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_look_id'), table_name='avatar_scenarios')
    op.drop_constraint('fk_avatar_scenarios_look_id', 'avatar_scenarios', type_='foreignkey')
    op.drop_column('avatar_scenarios', 'creation_error')
    op.drop_column('avatar_scenarios', 'creation_status')
    op.drop_column('avatar_scenarios', 'prepared_photo_url')
    op.drop_column('avatar_scenarios', 'original_photo_url')
    op.drop_column('avatar_scenarios', 'look_id')

    op.drop_index(op.f('ix_avatar_looks_look_id'), table_name='avatar_looks')
    op.drop_table('avatar_looks')
