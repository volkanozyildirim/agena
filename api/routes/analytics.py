from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import CurrentTenant, get_current_tenant
from core.database import get_db_session
from services.analytics_service import AnalyticsService
from services.dora_service import DoraService

router = APIRouter(prefix='/analytics', tags=['analytics'])


# ── Response schemas ──────────────────────────────────────────────────────────


class DailyStatItem(BaseModel):
    date: str
    count: int
    total_tokens: int
    cost_usd: float
    avg_duration_ms: int


class TaskVelocityItem(BaseModel):
    date: str
    completed: int
    failed: int
    queued: int
    total: int


class DailyResponse(BaseModel):
    daily_usage: list[DailyStatItem]
    task_velocity: list[TaskVelocityItem]


class ModelBreakdownItem(BaseModel):
    model: str
    count: int
    total_tokens: int
    cost_usd: float


class ModelBreakdownResponse(BaseModel):
    models: list[ModelBreakdownItem]


class SummaryResponse(BaseModel):
    period: str
    ai_call_count: int
    total_tokens: int
    cost_usd: float
    avg_duration_ms: int
    task_total: int
    task_completed: int
    task_failed: int
    completion_rate: float


class ProjectKPI(BaseModel):
    predictability: float
    productivity: float
    delivery_rate: float
    planning_accuracy: float


class ProjectTotals(BaseModel):
    planned: int
    completed: int
    failed: int


class WeeklyTrendItem(BaseModel):
    week: str
    planned: int
    completed: int
    failed: int


class TimeTrendItem(BaseModel):
    date: str
    avg_lead_time_hours: float
    avg_cycle_time_hours: float


class ThroughputTrendItem(BaseModel):
    week: str
    throughput: int


class ProjectAnalyticsResponse(BaseModel):
    period_days: int
    kpi: ProjectKPI
    totals: ProjectTotals
    avg_cycle_time_hours: float
    avg_lead_time_hours: float
    wip_count: int
    weekly_trend: list[WeeklyTrendItem]
    time_trend: list[TimeTrendItem]
    throughput_trend: list[ThroughputTrendItem]


class AgentPerformanceItem(BaseModel):
    role: str
    tasks: int
    success_rate: float
    avg_duration_ms: int


class ModelPerformanceItem(BaseModel):
    model: str
    tasks: int
    total_tokens: int
    cost_usd: float
    success_rate: float
    avg_duration_ms: int


class CostPerTaskTrendItem(BaseModel):
    date: str
    cost_per_task: float


class TokenUsageTrendItem(BaseModel):
    date: str
    total_tokens: int


class DoraDevelopmentResponse(BaseModel):
    coding_efficiency: float
    rework_rate: float
    avg_cost_per_task: float
    avg_completion_minutes: float
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    avg_tokens_per_task: int
    agent_performance: list[AgentPerformanceItem]
    model_performance: list[ModelPerformanceItem]
    cost_per_task_trend: list[CostPerTaskTrendItem]
    token_usage_trend: list[TokenUsageTrendItem]


class DoraDailyItem(BaseModel):
    date: str
    completed: int
    failed: int
    lead_time_hours: float | None
    mttr_hours: float | None


class DoraOverviewResponse(BaseModel):
    lead_time_hours: float | None
    deploy_frequency: float | None
    change_failure_rate: float | None
    mttr_hours: float | None
    daily: list[DoraDailyItem]


# ── DORA Quality schemas ─────────────────────────────────────────────────────


class QualityDailyTrendItem(BaseModel):
    date: str
    success_rate: float
    completed: int
    settled: int


class FailureCategoryItem(BaseModel):
    reason: str
    count: int


class DoraQualityResponse(BaseModel):
    success_rate: float
    first_time_rate: float
    completed: int
    failed: int
    benchmark: str
    daily_trend: list[QualityDailyTrendItem]
    failure_categories: list[FailureCategoryItem]


# ── DORA Bug Report schemas ──────────────────────────────────────────────────


class FailedTaskItem(BaseModel):
    id: int
    title: str
    failure_reason: str
    source: str
    created_at: str
    updated_at: str
    duration_sec: int


class FailureTrendItem(BaseModel):
    date: str
    failed: int
    failure_rate: float


class FailureReasonItem(BaseModel):
    reason: str
    count: int


class StaleTaskItem(BaseModel):
    id: int
    title: str
    source: str
    created_at: str
    running_minutes: int


class DoraBugsResponse(BaseModel):
    total_failed: int
    failure_rate: float
    mttr_minutes: float
    stale_count: int
    recent_failed: list[FailedTaskItem]
    failure_trend: list[FailureTrendItem]
    top_failure_reasons: list[FailureReasonItem]
    stale_tasks: list[StaleTaskItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get('/daily', response_model=DailyResponse)
async def get_daily_analytics(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> DailyResponse:
    service = AnalyticsService(db)
    daily_usage = await service.daily_stats(tenant.organization_id, days=days)
    task_velocity = await service.task_velocity(tenant.organization_id, days=days)
    return DailyResponse(
        daily_usage=[DailyStatItem(**d) for d in daily_usage],
        task_velocity=[TaskVelocityItem(**t) for t in task_velocity],
    )


@router.get('/summary', response_model=SummaryResponse)
async def get_summary(
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> SummaryResponse:
    service = AnalyticsService(db)
    data = await service.summary(tenant.organization_id)
    return SummaryResponse(**data)


@router.get('/models', response_model=ModelBreakdownResponse)
async def get_model_breakdown(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> ModelBreakdownResponse:
    service = AnalyticsService(db)
    items = await service.model_breakdown(tenant.organization_id, days=days)
    return ModelBreakdownResponse(models=[ModelBreakdownItem(**m) for m in items])


@router.get('/dora/project', response_model=ProjectAnalyticsResponse)
async def get_project_analytics(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> ProjectAnalyticsResponse:
    service = AnalyticsService(db)
    data = await service.project_analytics(tenant.organization_id, days=days)
    return ProjectAnalyticsResponse(**data)


@router.get('/dora/development', response_model=DoraDevelopmentResponse)
async def get_dora_development(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> DoraDevelopmentResponse:
    service = AnalyticsService(db)
    data = await service.dora_development(tenant.organization_id, days=days)
    return DoraDevelopmentResponse(**data)


@router.get('/dora/quality', response_model=DoraQualityResponse)
async def get_dora_quality(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> DoraQualityResponse:
    service = AnalyticsService(db)
    data = await service.dora_quality(tenant.organization_id, days=days)
    return DoraQualityResponse(**data)


@router.get('/dora/bugs', response_model=DoraBugsResponse)
async def get_dora_bugs(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> DoraBugsResponse:
    service = AnalyticsService(db)
    data = await service.dora_bugs(tenant.organization_id, days=days)
    return DoraBugsResponse(**data)


@router.get('/dora', response_model=DoraOverviewResponse)
async def get_dora_overview(
    days: int = Query(default=30, ge=1, le=365),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> DoraOverviewResponse:
    service = DoraService(db)
    data = await service.overview(tenant.organization_id, days=days)
    return DoraOverviewResponse(**data)
