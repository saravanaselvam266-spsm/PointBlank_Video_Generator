"""Add Azure-mirrored video thumbnail field

Revision ID: 008_add_video_thumbnail_azure_blob
Revises: 007_add_voice_cloning_fields
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '008_add_video_thumbnail'
down_revision: Union[str, Sequence[str], None] = '007_add_voice_cloning_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # HeyGen's thumbnail_url CDN link expires in 24-48h same as video_url —
    # without an Azure-mirrored copy, the Video Library grid would show broken
    # poster images shortly after generation.
    op.add_column('videos', sa.Column('azure_thumbnail_blob_name', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('videos', 'azure_thumbnail_blob_name')
