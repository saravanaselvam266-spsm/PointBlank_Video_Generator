"""Add real Doctor Original Voice cloning fields to voices

Revision ID: 007_add_voice_cloning_fields
Revises: 006_add_media_azure_storage
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '007_add_voice_cloning_fields'
down_revision: Union[str, Sequence[str], None] = '006_add_media_azure_storage'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A voice awaiting/undergoing real cloning has no provider voice id yet.
    op.alter_column('voices', 'heygen_voice_id', existing_type=sa.String(length=255), nullable=True)

    # Azure Blob mirror of the doctor's ORIGINAL uploaded recording — distinct
    # from the existing azure_blob_name/voice_storage_status pair, which mirror
    # a provider-hosted PREVIEW sample, not the source recording used for cloning.
    op.add_column('voices', sa.Column('source_audio_blob_name', sa.Text(), nullable=True))
    op.add_column('voices', sa.Column('original_filename', sa.String(length=255), nullable=True))
    op.add_column('voices', sa.Column('source_content_type', sa.String(length=100), nullable=True))

    # pending -> cloning -> ready | failed. Existing rows (catalog voices saved
    # via POST /voices, already carrying a real heygen_voice_id) backfill to
    # 'ready' so they remain immediately usable in video generation.
    op.add_column('voices', sa.Column('clone_status', sa.String(length=20), nullable=False, server_default='ready'))
    op.add_column('voices', sa.Column('clone_failure_reason', sa.Text(), nullable=True))
    op.add_column('voices', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('voices', 'is_default')
    op.drop_column('voices', 'clone_failure_reason')
    op.drop_column('voices', 'clone_status')
    op.drop_column('voices', 'source_content_type')
    op.drop_column('voices', 'original_filename')
    op.drop_column('voices', 'source_audio_blob_name')

    op.alter_column('voices', 'heygen_voice_id', existing_type=sa.String(length=255), nullable=False)
