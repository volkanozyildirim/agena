"""Stale Ticket Auto-Triage.

Once per cycle (default Sunday 18:00 UTC), scan every imported Jira /
Azure DevOps ticket whose `updated_at` is older than the org's
`triage_idle_days` threshold and that is still in an active status. For
each, ask the LLM to recommend one of: close / snooze / keep — with a
short reasoning paragraph. Persist the recommendation as a
TriageDecision so a human can bulk-approve from the UI.

The poller is idempotent: if a TriageDecision already exists for a
(org, task) and is still pending, we skip — the user hasn't acted on it
yet and re-running would just churn LLM cost. If the user has applied
or skipped the previous decision, we re-evaluate (the ticket may have
gone stale again).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_models.models.org_workflow_settings import OrgWorkflowSettings
from agena_models.models.organization import Organization
from agena_models.models.task_record import TaskRecord
from agena_models.models.triage_decision import TriageDecision
from agena_services.services.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


# TaskRecord.status values that count as "still open and worth triaging".
# Anything completed / failed / cancelled stays out of the triage queue.
ACTIVE_STATUSES = {'queued', 'pending', 'open', 'in_progress', 'running', 'paused'}


SYSTEM_PROMPT = (
    "You are a senior project triage assistant. Given a stale ticket "
    "(no activity for many days), decide one of three verdicts and write "
    "a single short sentence explaining why.\n\n"
    "Verdicts:\n"
    "  close   — looks resolved, abandoned, or obviously irrelevant now\n"
    "  snooze  — still potentially valid but no urgency; defer 30+ days\n"
    "  keep    — should stay open and active; do not snooze\n\n"
    "Be conservative on 'close' — only pick it when the evidence in the "
    "ticket itself suggests resolution (e.g. references a merged PR or a "
    "follow-up ticket). When unsure, prefer 'snooze' over 'close'.\n\n"
    "Reply with exactly two lines:\n"
    "VERDICT: close|snooze|keep\n"
    "REASON: <one sentence, ≤180 chars>"
)


async def _settings_for(db: AsyncSession, org_id: int) -> OrgWorkflowSettings:
    """Read or lazily create the org's workflow settings row."""
    row = (
        await db.execute(select(OrgWorkflowSettings).where(OrgWorkflowSettings.organization_id == org_id))
    ).scalar_one_or_none()
    if row is not None:
        return row
    row = OrgWorkflowSettings(organization_id=org_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def _parse_verdict(output: str) -> tuple[str, str]:
    """Parse the two-line response from the LLM into (verdict, reason).
    Falls back to ('keep', '...') if parsing fails so we never silently
    apply a destructive close."""
    verdict = 'keep'
    reason = ''
    for raw in (output or '').splitlines():
        line = raw.strip()
        if line.lower().startswith('verdict:'):
            v = line.split(':', 1)[1].strip().lower()
            if v in {'close', 'snooze', 'keep'}:
                verdict = v
        elif line.lower().startswith('reason:'):
            reason = line.split(':', 1)[1].strip()[:180]
    if not reason:
        reason = 'No reasoning emitted; defaulting to keep'
    return verdict, reason


async def _evaluate(task: TaskRecord, idle_days: int) -> tuple[str, int, str]:
    """Run a single LLM call to classify one stale ticket.
    Returns (verdict, confidence_0_100, reasoning)."""
    user_prompt = (
        f'Source: {task.source}\n'
        f'External ID: {task.external_id}\n'
        f'Title: {task.title or ""}\n'
        f'Status: {task.status}\n'
        f'Priority: {task.priority or "—"}\n'
        f'Assigned to: {task.assigned_to or "—"}\n'
        f'Idle for: {idle_days} days\n'
        f'Has linked PR: {"yes" if task.pr_url else "no"}\n'
        f'Has branch: {"yes" if task.branch_name else "no"}\n\n'
        f'## Description\n{(task.description or "")[:3000]}\n'
    )
    llm = LLMProvider(provider='openai')
    output, _usage, _model, _cached = await llm.generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        complexity_hint='light',
        max_output_tokens=200,
    )
    verdict, reason = _parse_verdict(output or '')
    # Confidence: a coarse mapping. We don't ask the LLM for a number
    # explicitly because that adds tokens for marginal value; instead
    # idle_days drives the floor and the user's manual override teaches
    # us over time (acked verdicts vs overridden ones).
    if idle_days >= 90:
        confidence = 75
    elif idle_days >= 60:
        confidence = 65
    else:
        confidence = 55
    if verdict == 'keep':
        # When the model picks "keep", the action is non-destructive,
        # so we publish higher confidence — it's fine.
        confidence = max(confidence, 70)
    return verdict, confidence, reason


async def scan_for_org(
    db: AsyncSession,
    org_id: int,
    *,
    now: datetime | None = None,
) -> int:
    """Run a triage pass for one org. Returns number of NEW decisions
    persisted. Re-uses pending decisions; skips applied/overridden ones
    unless the ticket has gone stale again since."""
    settings = await _settings_for(db, org_id)
    if not settings.triage_enabled:
        return 0

    sources = [s.strip() for s in (settings.triage_sources or '').split(',') if s.strip()]
    if not sources:
        return 0

    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=settings.triage_idle_days)

    rows = (
        await db.execute(
            select(TaskRecord).where(
                TaskRecord.organization_id == org_id,
                TaskRecord.source.in_(sources),
                TaskRecord.status.in_(list(ACTIVE_STATUSES)),
                TaskRecord.updated_at <= cutoff,
            )
        )
    ).scalars().all()

    new_decisions = 0
    for task in rows:
        existing = (
            await db.execute(
                select(TriageDecision).where(
                    TriageDecision.organization_id == org_id,
                    TriageDecision.task_id == task.id,
                )
            )
        ).scalar_one_or_none()
        # Skip if a pending decision already exists — user hasn't acted.
        # Re-evaluate once a decision has been applied / skipped so we can
        # surface a fresh recommendation if the ticket goes stale again.
        if existing and existing.status == 'pending':
            continue

        idle_days = max(1, (now - task.updated_at).days)
        try:
            verdict, confidence, reasoning = await _evaluate(task, idle_days)
        except Exception:
            logger.exception('Triage LLM call failed for task=%s', task.id)
            continue

        if existing is not None:
            existing.idle_days = idle_days
            existing.ai_verdict = verdict
            existing.ai_confidence = confidence
            existing.ai_reasoning = reasoning
            existing.status = 'pending'
            existing.applied_verdict = None
            existing.applied_at = None
            existing.applied_by_user_id = None
        else:
            db.add(TriageDecision(
                organization_id=org_id,
                task_id=task.id,
                source=task.source,
                external_id=task.external_id,
                ticket_title=task.title,
                idle_days=idle_days,
                ai_verdict=verdict,
                ai_confidence=confidence,
                ai_reasoning=reasoning,
                status='pending',
            ))
        new_decisions += 1

    if new_decisions:
        await db.commit()
        logger.info('Triage scan: org=%s new/refreshed decisions=%s', org_id, new_decisions)
    return new_decisions


async def scan_all_orgs(db: AsyncSession) -> int:
    org_ids: Iterable[int] = (
        await db.execute(select(Organization.id))
    ).scalars().all()
    total = 0
    for oid in org_ids:
        try:
            total += await scan_for_org(db, oid)
        except Exception:
            logger.exception('Triage scan failed for org=%s', oid)
    return total


async def apply_decision(
    db: AsyncSession,
    decision_id: int,
    *,
    organization_id: int,
    user_id: int,
    verdict: str,
) -> TriageDecision:
    """User-driven action on a decision. Updates the linked TaskRecord's
    status and posts a comment to the source system if a writeback
    integration is wired up.

    For now we only update the AGENA-side TaskRecord — full writeback
    (Jira transition, Azure work-item state change) is opt-in and lives
    behind separate integration plumbing. The decision row itself
    carries the audit trail regardless."""
    if verdict not in {'close', 'snooze', 'keep'}:
        raise ValueError('invalid verdict')

    decision = (
        await db.execute(
            select(TriageDecision).where(
                TriageDecision.id == decision_id,
                TriageDecision.organization_id == organization_id,
            )
        )
    ).scalar_one_or_none()
    if decision is None:
        raise ValueError('decision not found')

    task = (
        await db.execute(select(TaskRecord).where(TaskRecord.id == decision.task_id))
    ).scalar_one_or_none()

    if task is not None:
        if verdict == 'close':
            task.status = 'completed'
        elif verdict == 'snooze':
            task.status = 'paused'
        # 'keep' = no change

    decision.status = 'applied'
    decision.applied_verdict = verdict
    decision.applied_at = datetime.utcnow()
    decision.applied_by_user_id = user_id
    await db.commit()
    await db.refresh(decision)
    return decision


async def skip_decision(
    db: AsyncSession,
    decision_id: int,
    *,
    organization_id: int,
    user_id: int,
) -> TriageDecision:
    decision = (
        await db.execute(
            select(TriageDecision).where(
                TriageDecision.id == decision_id,
                TriageDecision.organization_id == organization_id,
            )
        )
    ).scalar_one_or_none()
    if decision is None:
        raise ValueError('decision not found')
    decision.status = 'skipped'
    decision.applied_at = datetime.utcnow()
    decision.applied_by_user_id = user_id
    await db.commit()
    await db.refresh(decision)
    return decision
