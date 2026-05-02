"""/triage — stale Jira / Azure ticket auto-triage."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant
from agena_core.database import get_db_session
from agena_models.models.triage_decision import TriageDecision
from agena_services.services import triage_service

router = APIRouter(prefix='/triage', tags=['triage'])


class DecisionResponse(BaseModel):
    id: int
    task_id: int | None = None  # nullable for source-side decisions (no local TaskRecord)
    source: str
    external_id: str
    ticket_title: str | None = None
    ticket_url: str | None = None
    idle_days: int
    ai_verdict: str | None = None
    ai_confidence: int
    ai_reasoning: str | None = None
    status: str
    applied_verdict: str | None = None
    applied_at: datetime | None = None
    created_at: datetime


class ApplyRequest(BaseModel):
    verdict: str  # close | snooze | keep


class ApplyAllRequest(BaseModel):
    decision_ids: list[int]


@router.get('/decisions', response_model=list[DecisionResponse])
async def list_decisions(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
    status: str = 'pending',
    limit: int = 100,
) -> list[DecisionResponse]:
    rows = (
        await db.execute(
            select(TriageDecision)
            .where(TriageDecision.organization_id == tenant.organization_id)
            .where(TriageDecision.status == status)
            .order_by(desc(TriageDecision.idle_days))
            .limit(min(limit, 500))
        )
    ).scalars().all()
    return [DecisionResponse.model_validate(r, from_attributes=True) for r in rows]


@router.post('/scan')
async def scan_now(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Returns a diagnostic dict so the UI can explain a 0-result scan
    instead of just blinking the toast off:
        new_or_refreshed: int   — decisions newly created or re-evaluated
        considered:       int   — candidate task rows that met the filters
        threshold_days:   int   — current settings.triage_idle_days
        sources:          list  — normalised TaskRecord.source values
        reason:           str   — empty when result>0; otherwise one of
                                  triage_disabled / no_sources_configured /
                                  no_stale_candidates / all_candidates_have_pending_decisions
    """
    return await triage_service.scan_for_org(db, tenant.organization_id)


@router.post('/decisions/{decision_id}/apply')
async def apply(
    decision_id: int,
    body: ApplyRequest,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        d = await triage_service.apply_decision(
            db, decision_id,
            organization_id=tenant.organization_id,
            user_id=tenant.user_id,
            verdict=body.verdict,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {'ok': True, 'applied_verdict': d.applied_verdict}


@router.post('/decisions/{decision_id}/skip')
async def skip(
    decision_id: int,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        await triage_service.skip_decision(
            db, decision_id,
            organization_id=tenant.organization_id,
            user_id=tenant.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {'ok': True}


@router.post('/apply-all-ai-suggestions')
async def apply_all_ai(
    body: ApplyAllRequest,
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Apply each decision's AI-recommended verdict in one shot. Used by
    the "Hepsini onayla" button in the Triage UI."""
    rows = (
        await db.execute(
            select(TriageDecision).where(
                TriageDecision.organization_id == tenant.organization_id,
                TriageDecision.id.in_(body.decision_ids),
                TriageDecision.status == 'pending',
            )
        )
    ).scalars().all()
    applied = 0
    for d in rows:
        try:
            await triage_service.apply_decision(
                db, d.id,
                organization_id=tenant.organization_id,
                user_id=tenant.user_id,
                verdict=d.ai_verdict or 'keep',
            )
            applied += 1
        except Exception:
            pass
    return {'applied': applied, 'requested': len(body.decision_ids)}
