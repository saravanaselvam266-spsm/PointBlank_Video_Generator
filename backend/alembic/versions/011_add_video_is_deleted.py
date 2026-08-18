"""Add soft-delete (is_deleted) to videos — matches the existing pattern on avatar_scenarios/voices

Revision ID: 011_add_video_is_deleted
Revises: 010_qr_image_nullable
Create Date: 2026-08-18 00:00:00.000000

Adds a soft-delete flag so users can remove a video from their library
without losing the underlying record, Azure blob, or public share history.
No existing rows are touched beyond the new column defaulting to False.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '011_add_video_is_deleted'
down_revision: Union[str, Sequence[str], None] = '010_qr_image_nullable'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('videos', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index(op.f('ix_videos_is_deleted'), 'videos', ['is_deleted'])


def downgrade() -> None:
    op.drop_index(op.f('ix_videos_is_deleted'), table_name='videos')
    op.drop_column('videos', 'is_deleted')
