"""Review-backlog killer.

Periodically scan the org's open PRs and surface those that have been
sitting unreviewed past a configurable threshold. We compute an age-
weighted severity (info / warning / critical) and bump a per-PR nudge
counter so reviewers and team leads can see the backlog at a glance.

A separate notification path (Slack / email) is opt-in — the row in
`review_backlog_nudges` is the source of truth even if no message is
delivered.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_models.models.git_pull_request import GitPullRequest
from agena_models.models.org_workflow_settings import OrgWorkflowSettings
from agena_models.models.organization import Organization
from agena_models.models.review_backlog_nudge import ReviewBacklogNudge

logger = logging.getLogger(__name__)


# PR statuses that count as "still waiting for review". Anything merged
# / closed should drop off the backlog.
OPEN_STATUSES = {'open', 'opened', 'pending', 'review_required', 'in_review'}


async def _settings_for(db: AsyncSession, org_id: int) -> OrgWorkflowSettings:
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


def _severity_for_age(age_hours: int, warn: int, crit: int) -> str:
    if age_hours >= crit:
        return 'critical'
    if age_hours >= warn:
        return 'warning'
    return 'info'


async def scan_for_org(
    db: AsyncSession,
    org_id: int,
    *,
    now: datetime | None = None,
) -> dict[str, int]:
    """Update the backlog rows for one org. Returns a small status dict
    describing what happened so the API/poller can log it."""
    settings = await _settings_for(db, org_id)
    if not settings.backlog_enabled:
        return {'open_prs': 0, 'tracked': 0, 'resolved': 0}

    now = now or datetime.utcnow()
    warn = max(1, settings.backlog_warn_hours)
    crit = max(warn + 1, settings.backlog_critical_hours)

    exempt_repos = {
        r.strip() for r in (settings.backlog_exempt_repos or '').split(',') if r.strip()
    }

    rows = (
        await db.execute(
            select(GitPullRequest).where(
                GitPullRequest.organization_id == org_id,
                GitPullRequest.merged_at.is_(None),
                GitPullRequest.closed_at.is_(None),
            )
        )
    ).scalars().all()

    tracked = 0
    resolved = 0

    open_pr_ids = set()
    for pr in rows:
        if pr.repo_mapping_id in exempt_repos:
            continue
        # Treat any non-merged, non-closed PR as still open. The provider's
        # status string is too noisy to rely on across GitHub/Azure both.
        opened_at = pr.created_at_ext or pr.created_at
        if opened_at is None:
            continue
        age = now - opened_at
        age_hours = max(0, int(age.total_seconds() // 3600))
        if age_hours < warn:
            continue
        open_pr_ids.add(pr.id)
        severity = _severity_for_age(age_hours, warn, crit)

        existing = (
            await db.execute(
                select(ReviewBacklogNudge).where(
                    ReviewBacklogNudge.organization_id == org_id,
                    ReviewBacklogNudge.pr_id == pr.id,
                )
            )
        ).scalar_one_or_none()

        if existing is None:
            db.add(ReviewBacklogNudge(
                organization_id=org_id,
                pr_id=pr.id,
                repo_mapping_id=pr.repo_mapping_id,
                age_hours=age_hours,
                severity=severity,
                nudge_count=0,
                resolved_at=None,
            ))
            tracked += 1
        else:
            existing.age_hours = age_hours
            existing.severity = severity
            existing.repo_mapping_id = pr.repo_mapping_id
            if existing.resolved_at is not None:
                existing.resolved_at = None  # reopened? — keep tracking
            tracked += 1

    # Resolve nudges whose PRs are no longer in the open list (got
    # merged or closed since last scan).
    stale_nudges = (
        await db.execute(
            select(ReviewBacklogNudge).where(
                ReviewBacklogNudge.organization_id == org_id,
                ReviewBacklogNudge.resolved_at.is_(None),
            )
        )
    ).scalars().all()
    for n in stale_nudges:
        if n.pr_id not in open_pr_ids:
            n.resolved_at = now
            resolved += 1

    if tracked or resolved:
        await db.commit()
        logger.info('Review backlog: org=%s tracked=%s resolved=%s', org_id, tracked, resolved)
    return {'open_prs': len(open_pr_ids), 'tracked': tracked, 'resolved': resolved}


async def scan_all_orgs(db: AsyncSession) -> int:
    org_ids: Iterable[int] = (
        await db.execute(select(Organization.id))
    ).scalars().all()
    total = 0
    for oid in org_ids:
        try:
            r = await scan_for_org(db, oid)
            total += r.get('tracked', 0)
        except Exception:
            logger.exception('Review-backlog scan failed for org=%s', oid)
    return total


async def record_nudge(
    db: AsyncSession,
    nudge_id: int,
    *,
    organization_id: int,
    channel: str,
) -> ReviewBacklogNudge:
    """Mark that a nudge was sent via the given channel. The actual
    Slack/email send happens in caller code; this function only records
    the timestamp + counter."""
    n = (
        await db.execute(
            select(ReviewBacklogNudge).where(
                ReviewBacklogNudge.id == nudge_id,
                ReviewBacklogNudge.organization_id == organization_id,
            )
        )
    ).scalar_one_or_none()
    if n is None:
        raise ValueError('nudge not found')

    n.last_nudged_at = datetime.utcnow()
    n.nudge_count = (n.nudge_count or 0) + 1
    n.last_nudge_channel = channel
    if n.severity == 'critical' and n.escalated_at is None:
        n.escalated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(n)
    return n
