from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from agena_core.db.base import Base


class GitPullRequestReview(Base):
    """One row per (PR, reviewer) pair. Powers the 'Help Others %'
    contributor metric — i.e. how much of an engineer's activity is
    spent reviewing other people's code vs writing their own.

    Source rows differ by provider:
      - Azure DevOps: ``pullrequests.reviewers[]`` array, where
        ``vote != 0`` means the reviewer actually engaged.
      - GitHub: ``pulls/{n}/reviews`` and ``requested_reviewers``.
    """

    __tablename__ = 'git_pull_request_reviews'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    repo_mapping_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    pull_request_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    reviewer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    # -10 = rejected, -5 = waiting for author, 0 = no vote, 5 = approved with suggestions, 10 = approved.
    vote: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    organization = relationship('Organization')

    __table_args__ = (
        UniqueConstraint(
            'organization_id', 'repo_mapping_id', 'pull_request_id', 'reviewer_email',
            name='uq_git_pr_review',
        ),
    )
