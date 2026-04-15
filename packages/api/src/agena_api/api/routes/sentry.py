from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant
from agena_core.database import get_db_session
from agena_models.schemas.sentry import SentryIssueItem, SentryIssueListResponse
from agena_services.integrations.sentry_client import SentryClient
from agena_services.services.integration_config_service import IntegrationConfigService

router = APIRouter(prefix='/sentry', tags=['sentry'])


async def _sentry_cfg(db: AsyncSession, organization_id: int) -> dict[str, str]:
    svc = IntegrationConfigService(db)
    config = await svc.get_config(organization_id, 'sentry')
    if config is None or not config.secret:
        raise HTTPException(status_code=400, detail='Sentry integration not configured')
    extra = config.extra_config or {}
    org_slug = str(extra.get('organization_slug') or '').strip()
    project_slug = str(extra.get('project_slug') or '').strip()
    if not org_slug or not project_slug:
        raise HTTPException(status_code=400, detail='Sentry org/project is not configured in integration settings')
    return {
        'api_token': config.secret,
        'base_url': config.base_url or 'https://sentry.io/api/0',
        'organization_slug': org_slug,
        'project_slug': project_slug,
    }


@router.get('/issues', response_model=SentryIssueListResponse)
async def list_sentry_issues(
    query: str = Query('is:unresolved'),
    limit: int = Query(50, ge=1, le=100),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> SentryIssueListResponse:
    cfg = await _sentry_cfg(db, tenant.organization_id)
    client = SentryClient()
    try:
        issues = await client.list_issues(
            cfg,
            organization_slug=cfg['organization_slug'],
            project_slug=cfg['project_slug'],
            query=query,
            limit=limit,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail='Sentry API token is invalid or lacks permissions') from exc
        raise HTTPException(status_code=502, detail=f'Sentry request failed ({exc.response.status_code})') from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f'Sentry connection failed: {exc}') from exc

    parsed: list[SentryIssueItem] = []
    for i in issues:
        parsed.append(
            SentryIssueItem(
                id=str(i.get('id') or ''),
                short_id=str(i.get('shortId') or '') or None,
                title=str(i.get('title') or 'Sentry issue'),
                level=str(i.get('level') or 'error'),
                status=str(i.get('status') or '') or None,
                culprit=str(i.get('culprit') or '') or None,
                count=int(i.get('count') or 0),
                user_count=int(i.get('userCount') or 0),
                last_seen=str(i.get('lastSeen') or '') or None,
                permalink=str(i.get('permalink') or '') or None,
            )
        )

    return SentryIssueListResponse(
        organization_slug=cfg['organization_slug'],
        project_slug=cfg['project_slug'],
        issues=parsed,
    )
