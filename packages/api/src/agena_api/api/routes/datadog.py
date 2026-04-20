"""Datadog integration routes — browse issues, import tasks."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from agena_api.api.dependencies import CurrentTenant, get_current_tenant
from agena_core.database import get_db_session
from agena_services.services.integration_config_service import IntegrationConfigService

router = APIRouter(prefix='/datadog', tags=['datadog'])


@router.get('/issues')
async def list_datadog_issues(
    query: str = Query(default='status:open'),
    limit: int = Query(default=50, ge=1, le=100),
    time_from: str = Query(default='-24h'),
    tenant: CurrentTenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    config = await IntegrationConfigService(db).get_config(tenant.organization_id, 'datadog')
    if config is None or not config.secret:
        raise HTTPException(status_code=400, detail='Datadog integration not configured')

    extra = config.extra_config or {}
    app_key = str(extra.get('app_key') or '').strip()
    if not app_key:
        raise HTTPException(status_code=400, detail='Datadog Application Key missing')

    from agena_services.integrations.datadog_client import DatadogClient
    client = DatadogClient()
    dd_cfg = {
        'api_key': config.secret,
        'app_key': app_key,
        'base_url': config.base_url or 'https://api.datadoghq.com',
    }
    try:
        issues = await client.list_error_tracking_issues(dd_cfg, query=query, limit=limit, time_from=time_from)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Datadog API error: {exc}') from exc
    return issues
