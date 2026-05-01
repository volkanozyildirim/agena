"""/insights — surfaces cross-source correlations produced by the
CorrelationService poller. Read-only for now: the UI shows clusters and
lets users acknowledge them. The poller writes; the API reads and acks."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant
from agena_core.database import get_db_session
from agena_models.models.correlation import Correlation
from agena_services.services.correlation_service import detect_for_org

router = APIRouter(prefix='/insights', tags=['insights'])


class CorrelationResponse(BaseModel):
    id: int
    window_start: datetime
    window_end: datetime
    primary_kind: str
    primary_ref: str
    primary_label: str
    related_events: list[dict[str, Any]] | None = None
    confidence: int
    severity: str | None = None
    narrative: str | None = None
    repo_mapping_id: str | None = None
    acknowledged_at: datetime | None = None
    user_verdict: str | None = None
    created_at: datetime


class AckRequest(BaseModel):
    verdict: str  # 'confirmed' | 'false_positive' | 'noted'


@router.get('/correlations', response_model=list[CorrelationResponse])
async def list_correlations(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
    min_confidence: int = 70,
    limit: int = 50,
) -> list[CorrelationResponse]:
    """Most recent N clusters above the confidence threshold."""
    rows = (
        await db.execute(
            select(Correlation)
            .where(Correlation.organization_id == tenant.organization_id)
            .where(Correlation.confidence >= min_confidence)
            .order_by(desc(Correlation.window_end))
            .limit(min(limit, 200))
        )
    ).scalars().all()
    return [CorrelationResponse.model_validate(r, from_attributes=True) for r in rows]


@router.post('/correlations/scan')
async def scan_now(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Manually trigger a correlation pass for this org. Useful for the
    Insights page's Refresh button — the worker poller already runs every
    5 minutes, but a UI-driven run feels responsive at demo time."""
    new_clusters = await detect_for_org(db, tenant.organization_id)
    return {'new_clusters': new_clusters}


@router.post('/correlations/{correlation_id}/ack')
async def acknowledge(
    correlation_id: int,
    body: AckRequest,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """User feedback on whether the cluster was useful — used later to
    tune confidence thresholds."""
    if body.verdict not in {'confirmed', 'false_positive', 'noted'}:
        raise HTTPException(status_code=400, detail='invalid verdict')

    row = (
        await db.execute(
            select(Correlation).where(
                Correlation.id == correlation_id,
                Correlation.organization_id == tenant.organization_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail='correlation not found')

    row.acknowledged_at = datetime.utcnow()
    row.acknowledged_by_user_id = tenant.user_id
    row.user_verdict = body.verdict
    await db.commit()
    return {'ok': True}


@router.post('/correlations/{correlation_id}/unack')
async def clear_acknowledgement(
    correlation_id: int,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Undo a previous triage decision so the cluster reappears in the
    default list. Useful when a user clicked the wrong verdict."""
    row = (
        await db.execute(
            select(Correlation).where(
                Correlation.id == correlation_id,
                Correlation.organization_id == tenant.organization_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail='correlation not found')

    row.acknowledged_at = None
    row.acknowledged_by_user_id = None
    row.user_verdict = None
    await db.commit()
    return {'ok': True}
