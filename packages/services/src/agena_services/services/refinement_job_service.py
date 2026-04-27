"""Job-tracker around RefinementService.analyze.

The original /refinement/analyze endpoint runs synchronously and can take
several minutes. If the user navigates away from the page, the original
fetch is dropped and the result is lost — even though the LLM call may
have already cost money. This service persists the run state in the
`refinement_jobs` table and exposes a start-then-poll workflow:

  POST /refinement/analyze/start  -> creates a row, spawns asyncio task,
                                     returns {job_id} immediately
  GET  /refinement/jobs/{id}      -> read status + result
  GET  /refinement/jobs/active    -> resume any in-flight job on mount

The background task gets its own SessionLocal because the request-scope
DB session ends as soon as the start endpoint returns.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_core.database import SessionLocal
from agena_models.models.refinement_job import RefinementJob
from agena_models.schemas.refinement import (
    RefinementAnalyzeRequest,
    RefinementAnalyzeResponse,
)


logger = logging.getLogger(__name__)


# Strong refs to background tasks so asyncio's GC doesn't kill them
# before they finish writing the result back.
_RUNNING_TASKS: dict[int, asyncio.Task] = {}


class RefinementJobService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_job(
        self,
        organization_id: int,
        user_id: int,
        request: RefinementAnalyzeRequest,
    ) -> RefinementJob:
        sprint_ref = request.sprint_path or request.sprint_id or request.sprint_name
        job = RefinementJob(
            organization_id=organization_id,
            user_id=user_id,
            status='queued',
            provider=request.provider,
            sprint_ref=sprint_ref,
            payload=request.model_dump(mode='json'),
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get(self, organization_id: int, job_id: int) -> RefinementJob | None:
        job = await self.db.get(RefinementJob, job_id)
        if job is None or job.organization_id != organization_id:
            return None
        return job

    async def list_active(
        self,
        organization_id: int,
        user_id: int,
    ) -> list[RefinementJob]:
        stmt = (
            select(RefinementJob)
            .where(
                RefinementJob.organization_id == organization_id,
                RefinementJob.user_id == user_id,
                RefinementJob.status.in_(('queued', 'running')),
            )
            .order_by(desc(RefinementJob.created_at))
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


def spawn_analyze_task(
    job_id: int,
    organization_id: int,
    user_id: int,
    request: RefinementAnalyzeRequest,
) -> None:
    """Fire-and-forget the heavy analyze() call. Each task uses its own DB
    session because the request-scoped session is closed by the time we
    get scheduled."""
    task = asyncio.create_task(_run_analyze(job_id, organization_id, user_id, request))
    _RUNNING_TASKS[job_id] = task
    task.add_done_callback(lambda _t: _RUNNING_TASKS.pop(job_id, None))


async def _run_analyze(
    job_id: int,
    organization_id: int,
    user_id: int,
    request: RefinementAnalyzeRequest,
) -> None:
    # Local import to avoid a circular: refinement_service imports schemas
    # that some other layer also imports from here.
    from agena_services.services.refinement_service import RefinementService

    async with SessionLocal() as db:
        await _set_status(db, job_id, status='running')

    try:
        async with SessionLocal() as db:
            service = RefinementService(db)
            response: RefinementAnalyzeResponse = await service.analyze(
                organization_id, user_id, request
            )
            payload = response.model_dump(mode='json')

        async with SessionLocal() as db:
            await _set_completed(db, job_id, payload)
    except Exception as exc:  # noqa: BLE001 — we want every error captured
        logger.exception('Refinement job %s failed', job_id)
        async with SessionLocal() as db:
            await _set_failed(db, job_id, str(exc))


async def _set_status(db: AsyncSession, job_id: int, *, status: str) -> None:
    job = await db.get(RefinementJob, job_id)
    if job is None:
        return
    job.status = status
    await db.commit()


async def _set_completed(db: AsyncSession, job_id: int, result: dict[str, Any]) -> None:
    job = await db.get(RefinementJob, job_id)
    if job is None:
        return
    job.status = 'completed'
    job.result = result
    job.completed_at = datetime.utcnow()
    await db.commit()


async def _set_failed(db: AsyncSession, job_id: int, error: str) -> None:
    job = await db.get(RefinementJob, job_id)
    if job is None:
        return
    job.status = 'failed'
    job.error_message = error[:8000]
    job.completed_at = datetime.utcnow()
    await db.commit()
