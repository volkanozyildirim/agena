from __future__ import annotations

import logging
from typing import Any

import httpx

from agena_models.schemas.task import ExternalTask

logger = logging.getLogger(__name__)


class SentryClient:
    """Async client for Sentry Issues API."""

    def __init__(self) -> None:
        self.default_base_url = 'https://sentry.io/api/0'

    def _resolve(self, cfg: dict[str, str] | None) -> tuple[str, str]:
        cfg = cfg or {}
        base_url = (cfg.get('base_url') or self.default_base_url).strip().rstrip('/')
        if '/api/' not in base_url:
            base_url = f'{base_url}/api/0'
        token = (cfg.get('api_token') or '').strip()
        return base_url, token

    async def list_projects(
        self,
        cfg: dict[str, str],
        *,
        organization_slug: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        base_url, token = self._resolve(cfg)
        if not token:
            logger.warning('Sentry token not set; returning empty projects list.')
            return []

        url = f'{base_url}/organizations/{organization_slug}/projects/'
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        }
        params = {
            'limit': str(max(1, min(limit, 100))),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, list) else []

    async def list_issue_events(
        self,
        cfg: dict[str, str],
        *,
        organization_slug: str,
        issue_id: str,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        base_url, token = self._resolve(cfg)
        if not token:
            logger.warning('Sentry token not set; returning empty issue events list.')
            return []
        url = f'{base_url}/organizations/{organization_slug}/issues/{issue_id}/events/'
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        }
        params = {
            'limit': str(max(1, min(limit, 50))),
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, list) else []

    async def list_issues(
        self,
        cfg: dict[str, str],
        *,
        organization_slug: str,
        project_slug: str,
        query: str = 'is:unresolved',
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        base_url, token = self._resolve(cfg)
        if not token:
            logger.warning('Sentry token not set; returning empty issues list.')
            return []

        url = f'{base_url}/projects/{organization_slug}/{project_slug}/issues/'
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        }
        params = {
            'query': query,
            'limit': str(max(1, min(limit, 100))),
            'sort': 'freq',
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, list) else []

    async def get_event_json(
        self,
        cfg: dict[str, str],
        *,
        organization_slug: str,
        project_slug: str,
        event_id: str,
    ) -> dict[str, Any]:
        base_url, token = self._resolve(cfg)
        if not token:
            logger.warning('Sentry token not set; returning empty event json.')
            return {}
        url = f'{base_url}/projects/{organization_slug}/{project_slug}/events/{event_id}/json/'
        headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        return data if isinstance(data, dict) else {}

    def _extract_exception_summary(self, event_json: dict[str, Any]) -> tuple[str | None, list[str]]:
        entries = event_json.get('entries') or []
        if not isinstance(entries, list):
            return None, []
        for entry in entries:
            if not isinstance(entry, dict) or str(entry.get('type') or '') != 'exception':
                continue
            values = ((entry.get('data') or {}).get('values') or [])
            if not isinstance(values, list) or not values:
                continue
            first = values[0] or {}
            err_type = str(first.get('type') or '').strip()
            err_value = str(first.get('value') or '').strip()
            summary = f'{err_type}: {err_value}'.strip(': ').strip() or None
            frames = ((first.get('stacktrace') or {}).get('frames') or [])
            if not isinstance(frames, list):
                return summary, []
            rendered: list[str] = []
            for fr in reversed(frames[-18:]):
                if not isinstance(fr, dict):
                    continue
                filename = str(fr.get('filename') or '').strip()
                function = str(fr.get('function') or '').strip()
                lineno = fr.get('lineno')
                in_app = bool(fr.get('in_app'))
                bits = [b for b in [filename, function] if b]
                head = ' :: '.join(bits) if bits else '(unknown frame)'
                if lineno:
                    head = f'{head}:{lineno}'
                if in_app:
                    head = f'{head} [in_app]'
                rendered.append(head)
            return summary, rendered
        return None, []

    def _event_detail_lines(self, event_id: str | None, event_json: dict[str, Any], permalink: str | None) -> list[str]:
        if not event_json:
            return []
        lines: list[str] = []
        if event_id:
            lines.append(f'Event ID: {event_id}')
        transaction = str(event_json.get('transaction') or '').strip()
        if transaction:
            lines.append(f'Transaction: {transaction}')
        platform = str(event_json.get('platform') or '').strip()
        if platform:
            lines.append(f'Platform: {platform}')

        request = event_json.get('request') or {}
        if isinstance(request, dict):
            method = str(request.get('method') or '').strip()
            url = str(request.get('url') or '').strip()
            if method or url:
                lines.append(f'Request: {method} {url}'.strip())

        summary, stack_lines = self._extract_exception_summary(event_json)
        if summary:
            lines.append(f'Exception: {summary}')
        if stack_lines:
            lines.append('Stack Trace (latest frames):')
            lines.extend([f'  - {x}' for x in stack_lines])

        tags = event_json.get('tags') or {}
        if isinstance(tags, dict):
            keys = ['environment', 'release', 'runtime', 'server_name', 'browser', 'os']
            selected = [f'{k}={str(tags.get(k) or "").strip()}' for k in keys if str(tags.get(k) or '').strip()]
            if selected:
                lines.append(f'Tags: {", ".join(selected)}')

        if permalink:
            lines.append(f'Sentry URL: {permalink}')
        return lines

    def issue_to_external_task(
        self,
        issue: dict[str, Any],
        *,
        organization_slug: str,
        project_slug: str,
        event_id: str | None = None,
        event_json: dict[str, Any] | None = None,
    ) -> ExternalTask | None:
        issue_id = str(issue.get('id') or '').strip()
        if not issue_id:
            return None
        title = str(issue.get('title') or issue.get('shortId') or 'Sentry issue').strip()
        permalink = str(issue.get('permalink') or '').strip()
        level = str(issue.get('level') or 'error').strip()
        culprit = str(issue.get('culprit') or '').strip()
        count = str(issue.get('count') or '0').strip()
        user_count = str(issue.get('userCount') or '0').strip()
        status = str(issue.get('status') or '').strip() or None
        last_seen = str(issue.get('lastSeen') or '').strip()
        short_id = str(issue.get('shortId') or '').strip()

        desc_lines = [
            f'External Source: Sentry #{short_id or issue_id}',
            f'Organization: {organization_slug}',
            f'Project: {project_slug}',
            f'Level: {level}',
            f'Status: {status or "unknown"}',
            f'Events: {count}',
            f'Affected Users: {user_count}',
        ]
        if culprit:
            desc_lines.append(f'Culprit: {culprit}')
        if last_seen:
            desc_lines.append(f'Last Seen: {last_seen}')
        extra = self._event_detail_lines(event_id, event_json or {}, permalink or None)
        if extra:
            desc_lines.append('')
            desc_lines.extend(extra)
        elif permalink:
            desc_lines.append(f'Sentry URL: {permalink}')

        return ExternalTask(
            id=f'{project_slug}:{issue_id}',
            title=title,
            description='\n'.join(desc_lines),
            source='sentry',
            state=status,
            created_date=None,
            web_url=permalink or None,
        )

    def issues_to_external_tasks(
        self,
        issues: list[dict[str, Any]],
        *,
        organization_slug: str,
        project_slug: str,
    ) -> list[ExternalTask]:
        items: list[ExternalTask] = []
        for issue in issues:
            parsed = self.issue_to_external_task(
                issue,
                organization_slug=organization_slug,
                project_slug=project_slug,
            )
            if parsed is not None:
                items.append(parsed)
        return items
