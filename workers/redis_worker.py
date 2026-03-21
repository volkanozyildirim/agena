from __future__ import annotations

import asyncio
import logging
import uuid

from core.database import SessionLocal
from core.logging import configure_logging
from core.settings import get_settings
from db import models  # noqa: F401
from services.orchestration_service import OrchestrationService
from services.queue_service import QueueService
from services.task_service import TaskService

configure_logging()
logger = logging.getLogger(__name__)
settings = get_settings()


async def _run_single_task(payload: dict) -> None:
    organization_id = int(payload.get('organization_id', 0) or 0)
    task_id = int(payload.get('task_id', 0) or 0)
    create_pr = bool(payload.get('create_pr', True))
    lock_retries = int(payload.get('lock_retries', 0) or 0)

    if organization_id <= 0 or task_id <= 0:
        logger.error('Invalid queue payload: %s', payload)
        return

    async with SessionLocal() as session:
        task_service = TaskService(session)
        task = await task_service.get_task(organization_id, task_id)
        if task is None:
            logger.warning('Task not found, skipping payload=%s', payload)
            return
        if task.status in {'completed', 'failed', 'cancelled'}:
            logger.info('Skipping terminal task id=%s status=%s', task.id, task.status)
            return

        lock_scope = None
        for line in (task.description or '').splitlines():
            if line.lower().startswith('local repo path:'):
                lock_scope = line.split(':', 1)[1].strip()
                break
        if not lock_scope and 'external source:' in (task.description or '').lower():
            lock_scope = f"org:{organization_id}:external:{task.external_id or task.id}"

        queue_service = QueueService()
        lock_owner = f'{task_id}:{uuid.uuid4().hex}'
        lock_key = f'org:{organization_id}:{lock_scope}' if lock_scope else None
        if lock_key:
            acquired = await queue_service.acquire_lock(lock_key, lock_owner, ttl_sec=1800)
            if not acquired:
                if lock_retries >= 20:
                    task.status = 'failed'
                    task.failure_reason = 'Repo lock busy for too long; task aborted after retries'
                    await session.commit()
                    await task_service.add_log(task.id, organization_id, 'failed', task.failure_reason)
                    return
                await task_service.add_log(task.id, organization_id, 'queued', 'Repo lock busy, re-queued')
                task.status = 'queued'
                await session.commit()
                payload['lock_retries'] = lock_retries + 1
                await queue_service.enqueue(payload)
                return

        service = OrchestrationService(db_session=session)
        try:
            await service.run_task_record(
                organization_id=organization_id,
                task_id=task_id,
                create_pr=create_pr,
            )
        finally:
            if lock_key:
                await queue_service.release_lock(lock_key, lock_owner)


async def process_queue() -> None:
    queue_service = QueueService()
    max_workers = max(1, settings.max_workers)
    active_tasks: set[asyncio.Task] = set()

    while True:
        queue_size = await queue_service.queue_size()
        desired_concurrency = min(max_workers, max(1, queue_size))

        while len(active_tasks) < desired_concurrency:
            payload = await queue_service.dequeue(timeout=1)
            if not payload:
                break

            task = asyncio.create_task(_run_safe(payload))
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)

        if not active_tasks:
            await asyncio.sleep(1)
            continue

        await asyncio.sleep(0.2)


async def _run_safe(payload: dict) -> None:
    try:
        await _run_single_task(payload)
    except Exception:
        logger.exception('Worker failed payload=%s', payload)


if __name__ == '__main__':
    asyncio.run(process_queue())
