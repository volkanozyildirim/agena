"""ChatOps command parser and executor for Teams / Slack integration."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_models.models.task_record import TaskRecord
from agena_services.services.queue_service import QueueService
from agena_services.services.task_service import TaskService

logger = logging.getLogger(__name__)


@dataclass
class ChatOpsResult:
    """Structured response from a chatops command."""
    text: str
    facts: list[dict[str, str]] | None = None
    color: str = '14B8A6'  # teal


# ── Command registry ──────────────────────────────────────────────

_COMMANDS: dict[str, str] = {
    'help': 'Show available commands',
    'fix': 'Create a task and assign to AI  →  fix <description>',
    'create': 'Create a task (without auto-assign)  →  create <title>',
    'status': 'Get task status  →  status <task_id>',
    'queue': 'Show current queue size and items',
    'cancel': 'Cancel a queued task  →  cancel <task_id>',
    'recent': 'List recent tasks  →  recent [count]',
    'stats': 'Sprint / task statistics',
}


async def handle_command(
    text: str,
    organization_id: int,
    user_id: int,
    db: AsyncSession,
) -> ChatOpsResult:
    """Parse *text* and dispatch to the matching handler."""

    cleaned = _strip_mention(text).strip()
    if not cleaned:
        return _help()

    parts = cleaned.split(None, 1)
    cmd = parts[0].lower()
    arg = parts[1].strip() if len(parts) > 1 else ''

    handlers: dict[str, Any] = {
        'help': lambda: _help(),
        'fix': lambda: _fix(arg, organization_id, user_id, db),
        'create': lambda: _create(arg, organization_id, user_id, db),
        'status': lambda: _status(arg, organization_id, db),
        'queue': lambda: _queue(organization_id, db),
        'cancel': lambda: _cancel(arg, organization_id, db),
        'recent': lambda: _recent(arg, organization_id, db),
        'stats': lambda: _stats(organization_id, db),
    }

    handler = handlers.get(cmd)
    if handler is None:
        return ChatOpsResult(
            text=f"Unknown command: **{cmd}**\n\nType **help** to see available commands.",
            color='F59E0B',
        )

    result = handler()
    if hasattr(result, '__await__'):
        result = await result
    return result


# ── Helpers ────────────────────────────────────────────────────────

def _strip_mention(text: str) -> str:
    """Remove Teams <at>…</at> tags and leading bot name."""
    text = re.sub(r'<at[^>]*>.*?</at>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'^@?\s*agena\s*', '', text, flags=re.IGNORECASE)
    return text.strip()


def _task_status_emoji(status: str) -> str:
    return {
        'new': '🆕', 'queued': '⏳', 'running': '⚙️',
        'completed': '✅', 'failed': '❌', 'cancelled': '🚫',
    }.get(status, '❓')


def _task_facts(task: TaskRecord) -> list[dict[str, str]]:
    facts = [
        {'name': 'ID', 'value': str(task.id)},
        {'name': 'Status', 'value': f"{_task_status_emoji(task.status)} {task.status}"},
        {'name': 'Title', 'value': task.title or '—'},
    ]
    if task.pr_url:
        facts.append({'name': 'PR', 'value': task.pr_url})
    if task.branch_name:
        facts.append({'name': 'Branch', 'value': task.branch_name})
    if task.failure_reason:
        facts.append({'name': 'Error', 'value': task.failure_reason[:200]})
    return facts


# ── Command implementations ────────────────────────────────────────

def _help() -> ChatOpsResult:
    lines = ['**AGENA ChatOps Commands**\n']
    for cmd, desc in _COMMANDS.items():
        lines.append(f"• **{cmd}** — {desc}")
    return ChatOpsResult(text='\n'.join(lines))


async def _fix(arg: str, org_id: int, user_id: int, db: AsyncSession) -> ChatOpsResult:
    if not arg:
        return ChatOpsResult(text="Usage: **fix <description>**\n\nExample: fix login page returns 500 error", color='F59E0B')

    svc = TaskService(db)
    task = await svc.create_task(
        organization_id=org_id,
        user_id=user_id,
        title=arg[:200],
        description=arg,
    )
    try:
        await svc.assign_task_to_ai(org_id, task.id, create_pr=True, mode='flow')
    except Exception as exc:
        logger.warning('ChatOps fix: assign failed for task %s: %s', task.id, exc)
        return ChatOpsResult(
            text=f"Task **#{task.id}** created but could not be queued: {exc}",
            facts=_task_facts(task),
            color='F59E0B',
        )

    return ChatOpsResult(
        text=f"Task **#{task.id}** created and queued for AI processing.",
        facts=_task_facts(task),
        color='22C55E',
    )


async def _create(arg: str, org_id: int, user_id: int, db: AsyncSession) -> ChatOpsResult:
    if not arg:
        return ChatOpsResult(text="Usage: **create <title>**", color='F59E0B')

    svc = TaskService(db)
    task = await svc.create_task(
        organization_id=org_id,
        user_id=user_id,
        title=arg[:200],
        description=arg,
    )
    return ChatOpsResult(
        text=f"Task **#{task.id}** created. Use **fix {task.id}** or assign from dashboard.",
        facts=_task_facts(task),
        color='22C55E',
    )


async def _status(arg: str, org_id: int, db: AsyncSession) -> ChatOpsResult:
    task_id = _parse_int(arg)
    if task_id is None:
        return ChatOpsResult(text="Usage: **status <task_id>**", color='F59E0B')

    svc = TaskService(db)
    task = await svc.get_task(org_id, task_id)
    if task is None:
        return ChatOpsResult(text=f"Task **#{task_id}** not found.", color='EF4444')

    return ChatOpsResult(
        text=f"{_task_status_emoji(task.status)} Task **#{task.id}** — {task.title}",
        facts=_task_facts(task),
    )


async def _queue(org_id: int, db: AsyncSession) -> ChatOpsResult:
    svc = TaskService(db)
    queue_items = await svc.list_queue_tasks(org_id)
    q_size = len(queue_items)

    running_result = await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.status == 'running',
        )
    )
    running = running_result.scalar() or 0

    facts = [
        {'name': 'Queued', 'value': str(q_size)},
        {'name': 'Running', 'value': str(running)},
    ]
    for i, item in enumerate(queue_items[:5]):
        facts.append({'name': f'#{item.get("task_id", "?")}', 'value': item.get('title', '—')[:80]})

    text = f"**Queue:** {q_size} waiting, {running} running"
    if q_size == 0 and running == 0:
        text = "Queue is empty. No tasks running."

    return ChatOpsResult(text=text, facts=facts)


async def _cancel(arg: str, org_id: int, db: AsyncSession) -> ChatOpsResult:
    task_id = _parse_int(arg)
    if task_id is None:
        return ChatOpsResult(text="Usage: **cancel <task_id>**", color='F59E0B')

    svc = TaskService(db)
    task = await svc.get_task(org_id, task_id)
    if task is None:
        return ChatOpsResult(text=f"Task **#{task_id}** not found.", color='EF4444')

    if task.status not in ('new', 'queued'):
        return ChatOpsResult(
            text=f"Task **#{task_id}** is **{task.status}** — can only cancel new or queued tasks.",
            color='F59E0B',
        )

    qs = QueueService()
    await qs.remove_task(organization_id=org_id, task_id=task_id)
    task.status = 'cancelled'
    await db.commit()

    return ChatOpsResult(
        text=f"Task **#{task_id}** cancelled.",
        facts=_task_facts(task),
        color='EF4444',
    )


async def _recent(arg: str, org_id: int, db: AsyncSession) -> ChatOpsResult:
    count = min(_parse_int(arg) or 5, 10)
    result = await db.execute(
        select(TaskRecord)
        .where(TaskRecord.organization_id == org_id)
        .order_by(TaskRecord.id.desc())
        .limit(count)
    )
    tasks = result.scalars().all()
    if not tasks:
        return ChatOpsResult(text="No tasks found.")

    lines = [f"**Last {len(tasks)} tasks:**\n"]
    for t in tasks:
        pr = f" — [PR]({t.pr_url})" if t.pr_url else ''
        lines.append(f"• {_task_status_emoji(t.status)} **#{t.id}** {t.title[:60]}{pr}")

    return ChatOpsResult(text='\n'.join(lines))


async def _stats(org_id: int, db: AsyncSession) -> ChatOpsResult:
    total = (await db.execute(
        select(func.count()).where(TaskRecord.organization_id == org_id)
    )).scalar() or 0

    completed = (await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.status == 'completed',
        )
    )).scalar() or 0

    failed = (await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.status == 'failed',
        )
    )).scalar() or 0

    running = (await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.status == 'running',
        )
    )).scalar() or 0

    queued = (await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.status == 'queued',
        )
    )).scalar() or 0

    prs = (await db.execute(
        select(func.count()).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.pr_url.isnot(None),
            TaskRecord.pr_url != '',
        )
    )).scalar() or 0

    success_rate = round(completed / total * 100) if total > 0 else 0

    facts = [
        {'name': 'Total Tasks', 'value': str(total)},
        {'name': 'Completed', 'value': f"✅ {completed}"},
        {'name': 'Failed', 'value': f"❌ {failed}"},
        {'name': 'Running', 'value': f"⚙️ {running}"},
        {'name': 'Queued', 'value': f"⏳ {queued}"},
        {'name': 'PRs Created', 'value': str(prs)},
        {'name': 'Success Rate', 'value': f"{success_rate}%"},
    ]

    return ChatOpsResult(
        text=f"**Organization Stats** — {success_rate}% success rate across {total} tasks",
        facts=facts,
    )


def _parse_int(s: str) -> int | None:
    s = s.strip().lstrip('#')
    try:
        return int(s)
    except (ValueError, TypeError):
        return None
