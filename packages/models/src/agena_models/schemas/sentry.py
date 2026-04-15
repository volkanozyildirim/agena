from __future__ import annotations

from pydantic import BaseModel


class SentryIssueItem(BaseModel):
    id: str
    short_id: str | None = None
    title: str
    level: str
    status: str | None = None
    culprit: str | None = None
    count: int = 0
    user_count: int = 0
    last_seen: str | None = None
    permalink: str | None = None


class SentryIssueListResponse(BaseModel):
    organization_slug: str
    project_slug: str
    issues: list[SentryIssueItem] = []
