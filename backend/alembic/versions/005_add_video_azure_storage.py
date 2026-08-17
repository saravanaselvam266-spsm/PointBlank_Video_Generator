"""Add Azure Blob storage fields to videos table

Revision ID: 005_add_video_azure_storage
Revises: 004_convert_urls_to_text
Create Date: 2026-08-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005_add_video_azure_storage'
down_revision: Union[str, Sequence[str], None] = '004_convert_urls_to_text'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('videos', sa.Column('azure_blob_name', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('storage_status', sa.String(length=50), nullable=False, server_default='pending'))
    op.create_index(op.f('ix_videos_storage_status'), 'videos', ['storage_status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_videos_storage_status'), table_name='videos')
    op.drop_column('videos', 'storage_status')
    op.drop_column('videos', 'azure_blob_name')
