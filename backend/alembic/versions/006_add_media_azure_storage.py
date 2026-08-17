"""Add Azure Blob storage fields to avatar_scenarios, voices, public_video_shares

Revision ID: 006_add_media_azure_storage
Revises: 005_add_video_azure_storage
Create Date: 2026-08-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '006_add_media_azure_storage'
down_revision: Union[str, Sequence[str], None] = '005_add_video_azure_storage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Final avatar asset + original doctor photo mirrored to Azure. Both
    # azure_blob_name and azure_preview_blob_name are populated (today pointing
    # at the same blob — HeyGen returns a single avatar image per look, there is
    # no separately-rendered "final" vs "preview" asset upstream) to satisfy the
    # documented schema shape without a wasteful duplicate upload.
    op.add_column('avatar_scenarios', sa.Column('azure_blob_name', sa.Text(), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('azure_preview_blob_name', sa.Text(), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('original_photo_azure_blob_name', sa.Text(), nullable=True))
    op.add_column('avatar_scenarios', sa.Column('avatar_storage_status', sa.String(length=50), nullable=False, server_default='pending'))
    op.create_index(op.f('ix_avatar_scenarios_avatar_storage_status'), 'avatar_scenarios', ['avatar_storage_status'], unique=False)

    # Voice preview audio mirrored to Azure (storage only — see conversation:
    # no voice-cloning provider integration exists in this codebase today).
    op.add_column('voices', sa.Column('azure_blob_name', sa.Text(), nullable=True))
    op.add_column('voices', sa.Column('voice_storage_status', sa.String(length=50), nullable=False, server_default='pending'))

    # QR PNG mirrored to Azure. qr_image (base64) is kept as a resilient
    # fallback — populated from the same bytes, not stored in addition to a
    # separate render — since it is tiny (a few KB) and the column is already
    # NOT NULL; qr_blob_name becomes the primary serving path once uploaded.
    op.add_column('public_video_shares', sa.Column('qr_blob_name', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('public_video_shares', 'qr_blob_name')

    op.drop_column('voices', 'voice_storage_status')
    op.drop_column('voices', 'azure_blob_name')

    op.drop_index(op.f('ix_avatar_scenarios_avatar_storage_status'), table_name='avatar_scenarios')
    op.drop_column('avatar_scenarios', 'avatar_storage_status')
    op.drop_column('avatar_scenarios', 'original_photo_azure_blob_name')
    op.drop_column('avatar_scenarios', 'azure_preview_blob_name')
    op.drop_column('avatar_scenarios', 'azure_blob_name')
