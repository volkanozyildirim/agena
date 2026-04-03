"""Teams (and future Slack) ChatOps webhook endpoints.

Teams Outgoing Webhook flow:
  1. User creates an Outgoing Webhook in a Teams channel named "agena"
  2. Teams gives a shared HMAC secret — store it in TEAMS_CHATOPS_SECRET env var
  3. When someone @agena in that channel, Teams POSTs here
  4. We validate HMAC, resolve the org, parse the command, and return an Adaptive Card
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_core.database import get_db_session
from agena_core.settings import get_settings
from agena_models.models.integration_config import IntegrationConfig
from agena_models.models.organization_member import OrganizationMember
from agena_models.models.user import User
from agena_services.services.chatops_service import ChatOpsResult, handle_command

router = APIRouter(prefix='/webhooks', tags=['chatops'])
logger = logging.getLogger(__name__)


# ── Teams Outgoing Webhook ─────────────────────────────────────────

@router.post('/teams')
async def teams_chatops(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """Receive messages from a Teams Outgoing Webhook and respond."""

    raw_body = await request.body()
    _verify_teams_hmac(request, raw_body)

    payload = await request.json()
    text = payload.get('text', '')
    from_user = payload.get('from', {})
    aad_object_id = from_user.get('aadObjectId', '')
    from_name = from_user.get('name', 'Teams User')
    tenant_id = (payload.get('channelData', {}) or {}).get('tenant', {}).get('id', '')
    service_url = payload.get('serviceUrl', '')

    logger.info(
        'Teams ChatOps from=%s aad=%s tenant=%s text=%s',
        from_name, aad_object_id, tenant_id, text[:100],
    )

    # Resolve organization + user from the Teams tenant or fallback to first org with teams integration
    org_id, user_id = await _resolve_org_and_user(db, aad_object_id, tenant_id)

    if org_id is None or user_id is None:
        return _teams_card(ChatOpsResult(
            text="Could not identify your AGENA organization. Make sure Teams integration is configured in Dashboard → Integrations.",
            color='EF4444',
        ))

    result = await handle_command(text, org_id, user_id, db)
    return _teams_card(result)


# ── HMAC verification ──────────────────────────────────────────────

def _verify_teams_hmac(request: Request, body: bytes) -> None:
    """Validate the HMAC-SHA256 signature from Teams Outgoing Webhook."""
    settings = get_settings()
    secret = settings.teams_chatops_secret
    if not secret:
        # No secret configured — skip validation (development mode)
        return

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('HMAC '):
        raise HTTPException(status_code=401, detail='Missing HMAC authorization')

    provided_hmac = auth_header[5:]  # strip "HMAC " prefix
    secret_bytes = base64.b64decode(secret)
    computed = base64.b64encode(
        hmac.new(secret_bytes, body, hashlib.sha256).digest()
    ).decode()

    if not hmac.compare_digest(provided_hmac, computed):
        raise HTTPException(status_code=401, detail='Invalid HMAC signature')


# ── Org/User resolution ───────────────────────────────────────────

async def _resolve_org_and_user(
    db: AsyncSession,
    aad_object_id: str,
    tenant_id: str,
) -> tuple[int | None, int | None]:
    """Try to map the Teams user to an AGENA org + user.

    Strategy:
    1. Look for a user whose email matches the AAD object ID (rare but covers manual mapping)
    2. Find organizations that have a Teams integration configured
    3. If tenant_id matches the stored base_url/project, use that org
    4. Fallback: first org with Teams integration (single-tenant deployments)
    """

    # Strategy: find orgs with teams integration
    result = await db.execute(
        select(IntegrationConfig).where(IntegrationConfig.provider == 'teams')
    )
    teams_configs = result.scalars().all()

    if not teams_configs:
        return None, None

    # If only one org has teams configured, use it
    target_org_id: int | None = None
    if len(teams_configs) == 1:
        target_org_id = teams_configs[0].organization_id
    else:
        # Multi-tenant: try to match by tenant_id stored in project or base_url field
        for cfg in teams_configs:
            if tenant_id and (
                tenant_id in (cfg.project or '')
                or tenant_id in (cfg.base_url or '')
            ):
                target_org_id = cfg.organization_id
                break
        # Fallback to first
        if target_org_id is None:
            target_org_id = teams_configs[0].organization_id

    # Find a user in this org (prefer owner/admin)
    member_result = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == target_org_id)
        .order_by(
            # Prefer owner > admin > member
            OrganizationMember.role.asc()
        )
        .limit(1)
    )
    member = member_result.scalar_one_or_none()
    user_id = member.user_id if member else None

    return target_org_id, user_id


# ── Response formatting ───────────────────────────────────────────

def _teams_card(result: ChatOpsResult) -> dict[str, Any]:
    """Format ChatOpsResult as a Teams Adaptive Card response."""

    body: list[dict[str, Any]] = [
        {
            'type': 'TextBlock',
            'text': result.text,
            'wrap': True,
            'size': 'Medium',
        }
    ]

    if result.facts:
        body.append({
            'type': 'FactSet',
            'facts': [
                {'title': f.get('name', ''), 'value': f.get('value', '')}
                for f in result.facts
            ],
        })

    return {
        'type': 'message',
        'attachments': [
            {
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'content': {
                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                    'type': 'AdaptiveCard',
                    'version': '1.4',
                    'body': body,
                    'msteams': {
                        'width': 'Full',
                    },
                },
            }
        ],
    }
