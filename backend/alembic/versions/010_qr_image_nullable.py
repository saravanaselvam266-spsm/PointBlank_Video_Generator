"""Make public_video_shares.qr_image nullable — stop persisting new QR binary data in PostgreSQL

Revision ID: 010_qr_image_nullable
Revises: 009_add_avatar_provider_status
Create Date: 2026-08-18 00:00:00.000000

Historical rows keep their existing base64 QR data untouched (no backfill,
no deletion). Going forward, new shares rely on Azure Blob as the sole store
for QR image bytes; qr_image is only ever populated by pre-existing legacy
rows created before this change.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '010_qr_image_nullable'
down_revision: Union[str, Sequence[str], None] = '009_add_avatar_provider_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('public_video_shares', 'qr_image', existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    # Cannot safely restore NOT NULL without knowing whether rows created after
    # this migration have NULL qr_image — leave nullable on downgrade.
    pass
