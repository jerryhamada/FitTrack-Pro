"""add client goal_type training_frequency_target photo_url

Revision ID: 08fcff923169
Revises: e6b5953b2892
Create Date: 2026-07-01 21:45:22.036897

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08fcff923169'
down_revision: Union[str, None] = 'e6b5953b2892'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('goal_type', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('training_frequency_target', sa.Integer(), nullable=True))
    op.add_column('clients', sa.Column('photo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('clients', 'photo_url')
    op.drop_column('clients', 'training_frequency_target')
    op.drop_column('clients', 'goal_type')
