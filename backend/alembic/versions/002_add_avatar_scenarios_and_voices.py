"""Add avatar_scenarios and voices tables

Revision ID: 002_scenarios_voices
Revises: af156c478b3f
Create Date: 2026-08-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002_scenarios_voices'
down_revision: Union[str, Sequence[str], None] = 'af156c478b3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequences if not exist
    op.execute("CREATE SEQUENCE IF NOT EXISTS pb_avatar_scenario_id_seq START WITH 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS pb_voice_id_seq START WITH 1")

    # 2. Create avatar_scenarios table
    op.create_table(
        'avatar_scenarios',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('avatar_scenario_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('doctor_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('avatar_type', sa.String(length=50), nullable=False, server_default='public'),
        sa.Column('photo_url', sa.String(length=500), nullable=True),
        sa.Column('background_type', sa.String(length=50), nullable=True, server_default='color'),
        sa.Column('background_value', sa.String(length=500), nullable=True, server_default='#FAFAFA'),
        sa.Column('position', sa.String(length=50), nullable=True, server_default='center'),
        sa.Column('scale', sa.String(length=50), nullable=True, server_default='1.0'),
        sa.Column('framing', sa.String(length=50), nullable=True, server_default='medium'),
        sa.Column('aspect_ratio', sa.String(length=50), nullable=True, server_default='16:9'),
        sa.Column('heygen_avatar_id', sa.String(length=255), nullable=True),
        sa.Column('heygen_talking_photo_id', sa.String(length=255), nullable=True),
        sa.Column('heygen_avatar_group_id', sa.String(length=255), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_avatar_scenarios_avatar_scenario_id'), 'avatar_scenarios', ['avatar_scenario_id'], unique=True)
    op.create_index(op.f('ix_avatar_scenarios_doctor_id'), 'avatar_scenarios', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_avatar_scenarios_user_id'), 'avatar_scenarios', ['user_id'], unique=False)
    op.create_index(op.f('ix_avatar_scenarios_is_deleted'), 'avatar_scenarios', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_avatar_scenarios_heygen_avatar_id'), 'avatar_scenarios', ['heygen_avatar_id'], unique=False)
    op.create_index(op.f('ix_avatar_scenarios_heygen_talking_photo_id'), 'avatar_scenarios', ['heygen_talking_photo_id'], unique=False)

    # 3. Create voices table
    op.create_table(
        'voices',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('voice_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('doctor_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('voice_type', sa.String(length=50), nullable=False, server_default='ai_voice'),
        sa.Column('heygen_voice_id', sa.String(length=255), nullable=False),
        sa.Column('language', sa.String(length=100), nullable=True),
        sa.Column('gender', sa.String(length=50), nullable=True),
        sa.Column('accent', sa.String(length=100), nullable=True),
        sa.Column('preview_url', sa.String(length=500), nullable=True),
        sa.Column('source_metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['doctor_id'], ['doctors.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_voices_voice_id'), 'voices', ['voice_id'], unique=True)
    op.create_index(op.f('ix_voices_doctor_id'), 'voices', ['doctor_id'], unique=False)
    op.create_index(op.f('ix_voices_user_id'), 'voices', ['user_id'], unique=False)
    op.create_index(op.f('ix_voices_is_deleted'), 'voices', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_voices_heygen_voice_id'), 'voices', ['heygen_voice_id'], unique=False)

    # 4. Add nullable columns to videos table
    op.add_column('videos', sa.Column('avatar_scenario_id', sa.String(length=36), nullable=True))
    op.add_column('videos', sa.Column('voice_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_videos_avatar_scenario_id', 'videos', 'avatar_scenarios', ['avatar_scenario_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_videos_voice_id', 'videos', 'voices', ['voice_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_videos_avatar_scenario_id'), 'videos', ['avatar_scenario_id'], unique=False)
    op.create_index(op.f('ix_videos_voice_id'), 'videos', ['voice_id'], unique=False)


def downgrade() -> None:
    op.drop_constraint('fk_videos_voice_id', 'videos', type_='foreignkey')
    op.drop_constraint('fk_videos_avatar_scenario_id', 'videos', type_='foreignkey')
    op.drop_index(op.f('ix_videos_voice_id'), table_name='videos')
    op.drop_index(op.f('ix_videos_avatar_scenario_id'), table_name='videos')
    op.drop_column('videos', 'voice_id')
    op.drop_column('videos', 'avatar_scenario_id')

    op.drop_index(op.f('ix_voices_heygen_voice_id'), table_name='voices')
    op.drop_index(op.f('ix_voices_is_deleted'), table_name='voices')
    op.drop_index(op.f('ix_voices_user_id'), table_name='voices')
    op.drop_index(op.f('ix_voices_doctor_id'), table_name='voices')
    op.drop_index(op.f('ix_voices_voice_id'), table_name='voices')
    op.drop_table('voices')

    op.drop_index(op.f('ix_avatar_scenarios_heygen_talking_photo_id'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_heygen_avatar_id'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_is_deleted'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_user_id'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_doctor_id'), table_name='avatar_scenarios')
    op.drop_index(op.f('ix_avatar_scenarios_avatar_scenario_id'), table_name='avatar_scenarios')
    op.drop_table('avatar_scenarios')
