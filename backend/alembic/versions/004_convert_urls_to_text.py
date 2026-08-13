"""Convert URL columns to Text type for signed CDN URLs

Revision ID: 004_convert_urls_to_text
Revises: 003_looks_and_prep
Create Date: 2026-08-13 11:57:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '004_convert_urls_to_text'
down_revision: Union[str, Sequence[str], None] = '003_looks_and_prep'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('avatar_scenarios', 'photo_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)
    op.alter_column('avatar_scenarios', 'original_photo_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)
    op.alter_column('avatar_scenarios', 'prepared_photo_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)
    op.alter_column('avatar_scenarios', 'heygen_preview_image_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)
    op.alter_column('avatar_looks', 'preview_image_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)
    op.alter_column('doctors', 'photo_url', type_=sa.Text(), existing_type=sa.String(length=500), nullable=True)


def downgrade() -> None:
    op.alter_column('doctors', 'photo_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
    op.alter_column('avatar_looks', 'preview_image_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
    op.alter_column('avatar_scenarios', 'heygen_preview_image_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
    op.alter_column('avatar_scenarios', 'prepared_photo_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
    op.alter_column('avatar_scenarios', 'original_photo_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
    op.alter_column('avatar_scenarios', 'photo_url', type_=sa.String(length=500), existing_type=sa.Text(), nullable=True)
