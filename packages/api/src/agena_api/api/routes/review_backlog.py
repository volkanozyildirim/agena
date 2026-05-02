"""/review-backlog — PRs sitting unreviewed past warn/critical thresholds."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant
from agena_core.database import get_db_session
from agena_models.models.git_pull_request import GitPullRequest
from agena_models.models.review_backlog_nudge import ReviewBacklogNudge
from agena_services.services import review_backlog_service

router = APIRouter(prefix='/review-backlog', tags=['review-backlog'])


class NudgeResponse(BaseModel):
    id: int
    pr_id: int
    pr_external_id: str | None = None
    pr_title: str | None = None
    pr_author: str | None = None
    pr_provider: str | None = None
    repo_mapping_id: str | None = None
    age_hours: int
    severity: str | None = None
    nudge_count: int
    last_nudged_at: datetime | None = None
    last_nudge_channel: str | None = None
    escalated_at: datetime | None = None
    resolved_at: datetime | None = None


class NudgeRequest(BaseModel):
    channel: str = 'slack_dm'  # slack_dm | email | manual


@router.get('', response_model=list[NudgeResponse])
async def list_backlog(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
    include_resolved: bool = False,
    limit: int = 100,
) -> list[NudgeResponse]:
    stmt = (
        select(ReviewBacklogNudge, GitPullRequest)
        .join(GitPullRequest, GitPullRequest.id == ReviewBacklogNudge.pr_id)
        .where(ReviewBacklogNudge.organization_id == tenant.organization_id)
        .order_by(desc(ReviewBacklogNudge.age_hours))
        .limit(min(limit, 500))
    )
    if not include_resolved:
        stmt = stmt.where(ReviewBacklogNudge.resolved_at.is_(None))
    rows = (await db.execute(stmt)).all()
    return [
        NudgeResponse(
            id=n.id, pr_id=n.pr_id,
            pr_external_id=pr.external_id, pr_title=pr.title, pr_author=pr.author,
            pr_provider=pr.provider, repo_mapping_id=n.repo_mapping_id,
            age_hours=n.age_hours, severity=n.severity, nudge_count=n.nudge_count,
            last_nudged_at=n.last_nudged_at, last_nudge_channel=n.last_nudge_channel,
            escalated_at=n.escalated_at, resolved_at=n.resolved_at,
        )
        for (n, pr) in rows
    ]


@router.post('/scan')
async def scan_now(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    return await review_backlog_service.scan_for_org(db, tenant.organization_id)


@router.post('/{nudge_id}/nudge')
async def nudge(
    nudge_id: int,
    body: NudgeRequest,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        n = await review_backlog_service.record_nudge(
            db, nudge_id,
            organization_id=tenant.organization_id,
            channel=body.channel,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {
        'ok': True,
        'nudge_count': n.nudge_count,
        'last_nudged_at': n.last_nudged_at.isoformat() if n.last_nudged_at else None,
    }
