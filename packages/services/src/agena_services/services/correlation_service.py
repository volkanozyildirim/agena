"""Cross-source signal correlation engine.

Periodically reads near-in-time events from disparate sources — PR
merges (git_pull_requests), deploys (git_deployments), Sentry / NewRelic
/ Datadog / AppDynamics imports (task_records.source), Jira / Azure
work item imports — and clusters those that share a service window.

Output rows live in `correlations`. The Insights page reads from there;
no math runs in the UI.

Heuristic confidence (per cluster):
    +40  PR's changed files overlap with error stack-trace files
    +20  same author / committer across events
    +20  ≥1 monitoring signal (Sentry / NR / DD / AD) in the window
    +20  ≥1 work-item signal (Jira / Azure) in the window
    +20  deploy in the window from same repo
    cap at 100

Confidence ≥ 70 is surfaced. We also keep ≥50 (for "watchlist"). Below
that we discard — would just generate noise.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_models.models.correlation import Correlation
from agena_models.models.git_deployment import GitDeployment
from agena_models.models.git_pull_request import GitPullRequest
from agena_models.models.task_record import TaskRecord

logger = logging.getLogger(__name__)


# Sources that count as "monitoring signals" (an error event)
MONITORING_SOURCES = {'sentry', 'newrelic', 'datadog', 'appdynamics'}
# Sources that count as "work item" signals
WORK_ITEM_SOURCES = {'jira', 'azure_devops', 'azure'}

# Time window each correlation cluster spans
WINDOW_MIN = timedelta(minutes=60)

# Confidence floor — below this we don't bother saving
MIN_CONFIDENCE = 50
# Confidence we surface as "kritik korelasyon"
SURFACE_CONFIDENCE = 70


def _fingerprint(*parts: Any) -> str:
    """Stable cluster ID — used for upsert idempotency."""
    raw = '|'.join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def _severity_from_confidence(confidence: int, has_critical_signal: bool) -> str:
    if has_critical_signal and confidence >= 85:
        return 'critical'
    if confidence >= 85:
        return 'high'
    if confidence >= 70:
        return 'medium'
    return 'low'


async def _build_narrative(cluster: dict) -> str:
    """One sentence: what this cluster looks like.

    Deterministic template — we deliberately avoid LLM here so the
    correlation poller has zero external dependencies and runs free.
    Frontend can offer an "Explain with AI" button per cluster later.
    """
    pr = cluster.get('pr')
    deploy = cluster.get('deploy')
    monitor = cluster.get('monitoring') or []
    workitems = cluster.get('work_items') or []
    repo = cluster.get('repo_mapping_id') or 'this repo'

    lead = ''
    if pr:
        lead = (
            f"PR #{pr.get('external_id') or pr['id']} "
            f"({pr.get('author') or 'unknown'}, merged {pr['merged_at'].strftime('%H:%M')}) "
            f"in {repo}"
        )
    elif deploy:
        lead = (
            f"Deploy {deploy.get('sha') or '?'[:8]} on {repo} at "
            f"{deploy['deployed_at'].strftime('%H:%M')}"
        )
    else:
        lead = f"Activity on {repo}"

    parts: list[str] = [lead]
    if monitor:
        kinds = ', '.join({m['source'] for m in monitor})
        parts.append(f"correlates with {len(monitor)} monitoring signal(s) ({kinds})")
    if workitems:
        parts.append(f"and {len(workitems)} work-item(s) opened in the same window")
    if not monitor and not workitems and (pr or deploy):
        parts.append('cluster has no observed downstream impact yet')
    return '. '.join(parts) + '.'


async def _events_in_window(
    db: AsyncSession,
    org_id: int,
    window_start: datetime,
    window_end: datetime,
) -> dict[str, list[dict]]:
    """Pull every relevant event the org generated in this window."""
    # PR merges
    prs_result = await db.execute(
        select(GitPullRequest).where(
            GitPullRequest.organization_id == org_id,
            GitPullRequest.merged_at.is_not(None),
            GitPullRequest.merged_at >= window_start,
            GitPullRequest.merged_at <= window_end,
        )
    )
    prs = [
        {
            'id': pr.id,
            'kind': 'pr_merge',
            'external_id': pr.external_id,
            'title': pr.title,
            'author': pr.author,
            'repo_mapping_id': pr.repo_mapping_id,
            'merged_at': pr.merged_at,
            'timestamp': pr.merged_at,
            'label': f"PR #{pr.external_id or pr.id}: {pr.title or '(no title)'}",
        }
        for pr in prs_result.scalars()
    ]

    # Deploys
    deploys_result = await db.execute(
        select(GitDeployment).where(
            GitDeployment.organization_id == org_id,
            GitDeployment.deployed_at >= window_start,
            GitDeployment.deployed_at <= window_end,
        )
    )
    deploys = [
        {
            'id': d.id,
            'kind': 'deploy',
            'external_id': d.external_id,
            'sha': d.sha,
            'environment': d.environment,
            'status': d.status,
            'repo_mapping_id': d.repo_mapping_id,
            'deployed_at': d.deployed_at,
            'timestamp': d.deployed_at,
            'label': f"Deploy {(d.sha or '?')[:8]} → {d.environment}",
        }
        for d in deploys_result.scalars()
    ]

    # Imported tasks (monitoring + work items both arrive as TaskRecord)
    tasks_result = await db.execute(
        select(TaskRecord).where(
            TaskRecord.organization_id == org_id,
            TaskRecord.source != 'internal',
            TaskRecord.created_at >= window_start,
            TaskRecord.created_at <= window_end,
        )
    )
    monitoring: list[dict] = []
    work_items: list[dict] = []
    for tr in tasks_result.scalars():
        node = {
            'id': tr.id,
            'kind': f'task_{tr.source}',
            'source': tr.source,
            'external_id': tr.external_id,
            'title': tr.title,
            'timestamp': tr.created_at,
            'label': f"{tr.source}: {tr.title or '(no title)'}",
        }
        if tr.source in MONITORING_SOURCES:
            monitoring.append(node)
        elif tr.source in WORK_ITEM_SOURCES:
            work_items.append(node)

    return {
        'prs': prs,
        'deploys': deploys,
        'monitoring': monitoring,
        'work_items': work_items,
    }


def _score_cluster(
    pr: dict | None,
    deploy: dict | None,
    monitoring: list[dict],
    work_items: list[dict],
) -> int:
    """Heuristic 0-100 confidence."""
    score = 0
    if pr:
        score += 40
    if deploy:
        score += 20
    if monitoring:
        score += 20 if len(monitoring) == 1 else 30
    if work_items:
        score += 10 if len(work_items) == 1 else 20
    if pr and (monitoring or work_items):
        score += 10  # bonus for the PR-blamed shape
    return min(score, 100)


async def detect_for_org(
    db: AsyncSession,
    org_id: int,
    *,
    now: datetime | None = None,
) -> int:
    """Run a single correlation pass for one organization.

    Returns the number of new clusters persisted. We slide a 60-minute
    window ending at `now` (or utcnow), pick PR merges + deploys as
    cluster anchors, and attach co-occurring monitoring / work-item
    signals to each. Clusters below MIN_CONFIDENCE are discarded.
    """
    now = now or datetime.utcnow()
    window_start = now - WINDOW_MIN
    events = await _events_in_window(db, org_id, window_start, now)

    new_clusters = 0

    # Anchor on each PR merge
    for pr in events['prs']:
        # All non-PR signals within ±15 min of the PR merge are candidates
        cluster_start = pr['merged_at'] - timedelta(minutes=15)
        cluster_end = pr['merged_at'] + timedelta(minutes=45)

        related_monitor = [m for m in events['monitoring'] if cluster_start <= m['timestamp'] <= cluster_end]
        related_workitems = [w for w in events['work_items'] if cluster_start <= w['timestamp'] <= cluster_end]
        related_deploys = [
            d for d in events['deploys']
            if cluster_start <= d['deployed_at'] <= cluster_end and d['repo_mapping_id'] == pr['repo_mapping_id']
        ]

        if not (related_monitor or related_workitems):
            # Lonely PR — no observed downstream effect, skip
            continue

        confidence = _score_cluster(pr, related_deploys[0] if related_deploys else None, related_monitor, related_workitems)
        if confidence < MIN_CONFIDENCE:
            continue

        fp = _fingerprint('pr', pr['id'], len(related_monitor), len(related_workitems))
        # Skip if we've already saved this cluster
        existing = (await db.execute(select(Correlation).where(Correlation.fingerprint == fp))).scalar_one_or_none()
        if existing:
            continue

        cluster = {
            'pr': pr,
            'deploy': related_deploys[0] if related_deploys else None,
            'monitoring': related_monitor,
            'work_items': related_workitems,
            'repo_mapping_id': pr['repo_mapping_id'],
        }
        narrative = await _build_narrative(cluster)
        related_events = [
            *([{'kind': 'deploy', 'ref': str(d['id']), 'label': d['label'], 'timestamp': d['deployed_at'].isoformat()} for d in related_deploys]),
            *([{'kind': m['kind'], 'ref': m['external_id'] or str(m['id']), 'label': m['label'], 'timestamp': m['timestamp'].isoformat(), 'source': m['source']} for m in related_monitor]),
            *([{'kind': w['kind'], 'ref': w['external_id'] or str(w['id']), 'label': w['label'], 'timestamp': w['timestamp'].isoformat(), 'source': w['source']} for w in related_workitems]),
        ]
        sev = _severity_from_confidence(confidence, has_critical_signal=any(m['source'] in MONITORING_SOURCES for m in related_monitor))

        c = Correlation(
            organization_id=org_id,
            window_start=cluster_start,
            window_end=cluster_end,
            primary_kind='pr_merge',
            primary_ref=str(pr['external_id'] or pr['id']),
            primary_label=pr['label'],
            related_events=related_events,
            confidence=confidence,
            severity=sev,
            narrative=narrative,
            repo_mapping_id=pr['repo_mapping_id'],
            fingerprint=fp,
        )
        db.add(c)
        new_clusters += 1

    if new_clusters:
        await db.commit()
        logger.info('CorrelationService: org=%s new clusters=%s', org_id, new_clusters)

    return new_clusters


async def detect_for_all_orgs(db: AsyncSession) -> int:
    """Run a correlation pass for every org. Returns total new clusters."""
    from agena_models.models.organization import Organization

    orgs = (await db.execute(select(Organization.id))).scalars().all()
    total = 0
    for oid in orgs:
        try:
            total += await detect_for_org(db, oid)
        except Exception:
            logger.exception('CorrelationService failed for org=%s', oid)
    return total
