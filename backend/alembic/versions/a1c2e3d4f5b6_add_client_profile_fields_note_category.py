"""add client age/gender/injuries and note category

Revision ID: a1c2e3d4f5b6
Revises: 08fcff923169
Create Date: 2026-07-02 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3d4f5b6'
down_revision: Union[str, None] = '08fcff923169'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clients', sa.Column('age', sa.Integer(), nullable=True))
    op.add_column('clients', sa.Column('gender', sa.String(), nullable=True))
    op.add_column('clients', sa.Column('injuries_limitations', sa.Text(), nullable=True))
    op.add_column('client_notes', sa.Column('category', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('client_notes', 'category')
    op.drop_column('clients', 'injuries_limitations')
    op.drop_column('clients', 'gender')
    op.drop_column('clients', 'age')
