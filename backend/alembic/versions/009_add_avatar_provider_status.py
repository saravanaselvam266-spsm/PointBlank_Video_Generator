"""Add ground-truth provider_status to avatar_scenarios

Revision ID: 009_add_avatar_provider_status
Revises: 008_add_video_thumbnail
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '009_add_avatar_provider_status'
down_revision: Union[str, Sequence[str], None] = '008_add_video_thumbnail'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Distinct from creation_status: a scenario can be READY (our own creation
    # pipeline finished) yet the provider avatar group has since been deleted
    # or expired on HeyGen's side. Only ever set by an actual video-generation
    # pre-check, never speculatively — keeps the Avatar Library list fast.
    op.add_column('avatar_scenarios', sa.Column('provider_status', sa.String(length=20), nullable=False, server_default='unknown'))


def downgrade() -> None:
    op.drop_column('avatar_scenarios', 'provider_status')
