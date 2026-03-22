from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.ai_usage_event import AIUsageEvent


class AIUsageEventService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_event(
        self,
        *,
        organization_id: int,
        user_id: int | None,
        task_id: int | None,
        operation_type: str,
        provider: str,
        model: str | None,
        status: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        cost_usd: float,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
        duration_ms: int | None = None,
        cache_hit: bool = False,
        local_repo_path: str | None = None,
        profile_version: int | None = None,
        error_message: str | None = None,
        details_json: dict | None = None,
    ) -> AIUsageEvent:
        event = AIUsageEvent(
            organization_id=organization_id,
            user_id=user_id,
            task_id=task_id,
            operation_type=operation_type,
            provider=provider or 'unknown',
            model=model,
            status=status,
            prompt_tokens=max(0, int(prompt_tokens)),
            completion_tokens=max(0, int(completion_tokens)),
            total_tokens=max(0, int(total_tokens)),
            cost_usd=max(0.0, float(cost_usd)),
            started_at=started_at,
            ended_at=ended_at,
            duration_ms=max(0, int(duration_ms)) if duration_ms is not None else None,
            cache_hit=bool(cache_hit),
            local_repo_path=(local_repo_path or '').strip() or None,
            profile_version=profile_version,
            error_message=(error_message or '').strip() or None,
            details_json=details_json or None,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def list_task_events(self, organization_id: int, task_id: int) -> list[AIUsageEvent]:
        result = await self.db.execute(
            select(AIUsageEvent)
            .where(AIUsageEvent.organization_id == organization_id, AIUsageEvent.task_id == task_id)
            .order_by(AIUsageEvent.created_at.desc())
        )
        return list(result.scalars().all())

