from __future__ import annotations

import logging
from typing import Any

import httpx

from agena_core.settings import get_settings
from agena_models.schemas.task import ExternalTask

logger = logging.getLogger(__name__)

# Field selector for issue reads. YouTrack returns custom fields (State,
# Assignee, Type, Priority, Story points/Estimation) under ``customFields``
# with a polymorphic ``value`` — a dict for enum/user/period fields, a bare
# number/string for simple fields. ``_cf_value`` normalises that.
_ISSUE_FIELDS = (
    'idReadable,id,summary,description,created,resolved,'
    'project(shortName,name),'
    'reporter(login,fullName,email),'
    'tags(name),'
    'customFields(name,value(name,login,fullName,email,minutes,presentation))'
)


class YouTrackClient:
    """JetBrains YouTrack REST client. Mirrors the public method surface of
    ``JiraClient`` so the service/route layer can drive either tracker with
    the same calls. Works against both YouTrack Cloud (``*.youtrack.cloud``)
    and self-hosted instances — the only difference is the ``base_url``.

    Auth is a permanent token (``perm:...``) sent as a Bearer header; unlike
    Jira there is no email/username component, so ``_resolve_config`` returns
    just ``(base_url, token)``.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    # ── config / http helpers ───────────────────────────────────────────
    def _resolve_config(self, cfg: dict[str, str] | None) -> tuple[str, str]:
        cfg = cfg or {}
        base_url = cfg.get('base_url') or self.settings.youtrack_base_url
        token = cfg.get('token') or cfg.get('api_token') or self.settings.youtrack_token
        return base_url, token

    @staticmethod
    def _api(base_url: str) -> str:
        # base_url may already include /api; normalise to a single /api root.
        host = (base_url or '').rstrip('/')
        if host.endswith('/api'):
            return host
        return f'{host}/api'

    @staticmethod
    def _host(base_url: str) -> str:
        host = (base_url or '').rstrip('/')
        if host.endswith('/api'):
            host = host[: -len('/api')]
        return host

    @staticmethod
    def _headers(token: str) -> dict[str, str]:
        return {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }

    # ── issue listing / import ──────────────────────────────────────────
    async def fetch_todo_issues(self, cfg: dict[str, str] | None = None) -> list[ExternalTask]:
        base_url, token = self._resolve_config(cfg)
        if not base_url:
            logger.warning('YOUTRACK_BASE_URL is not set; returning empty task list.')
            return []
        url = f'{self._api(base_url)}/issues'
        params = {'query': '#Unresolved', 'fields': _ISSUE_FIELDS, '$top': 50}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        return [self._to_external_task(issue, base_url=base_url) for issue in (data or [])]

    async def fetch_projects(self, cfg: dict[str, str] | None = None) -> list[dict[str, str]]:
        base_url, token = self._resolve_config(cfg)
        if not base_url:
            return []
        url = f'{self._api(base_url)}/admin/projects'
        params = {'fields': 'id,name,shortName,archived', '$top': 1000}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        out: list[dict[str, str]] = []
        for p in data or []:
            if not isinstance(p, dict) or p.get('archived'):
                continue
            short = str(p.get('shortName') or '').strip()
            name = str(p.get('name') or '').strip()
            if not short or not name:
                continue
            out.append({'id': str(p.get('id', '')), 'key': short, 'name': name})
        return out

    async def fetch_boards(
        self,
        cfg: dict[str, str] | None = None,
        *,
        project_key: str | None = None,
    ) -> list[dict[str, str]]:
        base_url, token = self._resolve_config(cfg)
        if not base_url:
            return []
        url = f'{self._api(base_url)}/agiles'
        params = {'fields': 'id,name,projects(shortName,name)', '$top': 100}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        wanted = (project_key or '').strip().lower()
        out: list[dict[str, str]] = []
        for b in data or []:
            if not isinstance(b, dict) or not b.get('id') or not b.get('name'):
                continue
            if wanted:
                shorts = [str((p or {}).get('shortName', '')).lower() for p in (b.get('projects') or [])]
                if wanted not in shorts:
                    continue
            out.append({'id': str(b.get('id', '')), 'name': str(b.get('name', '')), 'type': 'agile'})
        return out

    async def fetch_sprints(self, cfg: dict[str, str] | None = None, *, board_id: str) -> list[dict[str, str]]:
        base_url, token = self._resolve_config(cfg)
        if not base_url or not board_id:
            return []
        url = f'{self._api(base_url)}/agiles/{board_id}/sprints'
        params = {'fields': 'id,name,start,finish,archived', '$top': 100}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        out: list[dict[str, str]] = []
        for s in data or []:
            if not isinstance(s, dict) or not s.get('id') or not s.get('name'):
                continue
            out.append({
                'id': str(s.get('id', '')),
                'name': str(s.get('name', '')),
                'state': 'closed' if s.get('archived') else 'active',
                'start_date': str(s.get('start') or ''),
                'finish_date': str(s.get('finish') or ''),
            })
        return out

    async def fetch_board_states(self, cfg: dict[str, str] | None = None, *, board_id: str) -> list[str]:
        base_url, token = self._resolve_config(cfg)
        if not base_url or not board_id:
            return []
        url = f'{self._api(base_url)}/agiles/{board_id}'
        params = {'fields': 'columnSettings(columns(fieldValues(name,presentation)))'}
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        seen: list[str] = []
        columns = ((data.get('columnSettings') or {}).get('columns') or []) if isinstance(data, dict) else []
        for col in columns:
            for fv in (col.get('fieldValues') or []) if isinstance(col, dict) else []:
                name = str((fv or {}).get('name') or (fv or {}).get('presentation') or '').strip()
                if name and name not in seen:
                    seen.append(name)
        return seen

    async def _fetch_sprint_issues(
        self, *, base_url: str, token: str, board_id: str, sprint_id: str,
    ) -> list[dict[str, Any]]:
        url = f'{self._api(base_url)}/agiles/{board_id}/sprints/{sprint_id}'
        params = {'fields': f'issues({_ISSUE_FIELDS})'}
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.get(url, params=params, headers=self._headers(token))
            response.raise_for_status()
            data = response.json()
        return (data or {}).get('issues', []) or []

    async def _current_sprint_id(self, *, base_url: str, token: str, board_id: str) -> str | None:
        url = f'{self._api(base_url)}/agiles/{board_id}'
        params = {'fields': 'currentSprint(id),sprints(id,archived)'}
        async with httpx.AsyncClient(timeout=20) as client:
            try:
                resp = await client.get(url, params=params, headers=self._headers(token))
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError:
                return None
        cur = (data.get('currentSprint') or {}).get('id') if isinstance(data, dict) else None
        if cur:
            return str(cur)
        for s in (data.get('sprints') or []) if isinstance(data, dict) else []:
            if isinstance(s, dict) and not s.get('archived') and s.get('id'):
                return str(s['id'])
        return None

    async def fetch_board_issues(
        self,
        cfg: dict[str, str] | None = None,
        *,
        board_id: str,
        sprint_id: str | None = None,
        state: str | None = None,
    ) -> list[ExternalTask]:
        base_url, token = self._resolve_config(cfg)
        if not base_url or not board_id:
            return []
        sid = (sprint_id or '').strip() or await self._current_sprint_id(
            base_url=base_url, token=token, board_id=board_id,
        )
        if not sid:
            return []
        raw = await self._fetch_sprint_issues(base_url=base_url, token=token, board_id=board_id, sprint_id=sid)
        items = [self._to_external_task(issue, base_url=base_url) for issue in raw]
        if state:
            target = self._normalize_status(state)
            return [item for item in items if self._normalize_status(item.state) == target]
        return items

    async def fetch_sprint_work_items(
        self,
        cfg: dict[str, str] | None = None,
        *,
        board_id: str,
        sprint_id: str,
    ) -> list[ExternalTask]:
        base_url, token = self._resolve_config(cfg)
        if not base_url or not board_id or not sprint_id:
            return []
        raw = await self._fetch_sprint_issues(base_url=base_url, token=token, board_id=board_id, sprint_id=sprint_id)
        items: list[ExternalTask] = []
        for issue in raw:
            task = self._to_external_task(issue, base_url=base_url)
            task.sprint_id = sprint_id
            items.append(task)
        return items

    async def fetch_completed_issues(
        self,
        cfg: dict[str, str] | None = None,
        *,
        project: str | None = None,
        board_id: str | None = None,
        since_days: int | None = 730,
        max_items: int = 5000,
    ) -> list[ExternalTask]:
        """Resolved issues carrying a story-point estimate — used to backfill
        the refinement similarity index. Filters by project and resolution
        recency, then keeps only items with story_points > 0."""
        base_url, token = self._resolve_config(cfg)
        if not base_url:
            return []
        query_parts = ['#Resolved']
        if project:
            query_parts.append(f'project: {{{project}}}')
        if since_days and since_days > 0:
            query_parts.append(f'resolved date: -{int(since_days)}d .. Today')
        query = ' '.join(query_parts) + ' sort by: resolved desc'

        url = f'{self._api(base_url)}/issues'
        items: list[ExternalTask] = []
        skip = 0
        page_size = 100
        async with httpx.AsyncClient(timeout=60) as client:
            while True:
                params = {'query': query, 'fields': _ISSUE_FIELDS, '$top': page_size, '$skip': skip}
                resp = await client.get(url, params=params, headers=self._headers(token))
                resp.raise_for_status()
                rows = resp.json() or []
                if not rows:
                    break
                for issue in rows:
                    task = self._to_external_task(issue, base_url=base_url)
                    if task.story_points and task.story_points > 0:
                        items.append(task)
                skip += len(rows)
                if len(rows) < page_size or len(items) >= max_items:
                    break
        return items[:max_items] if max_items else items

    # ── single-issue reads ──────────────────────────────────────────────
    async def _get_issue(self, *, base_url: str, token: str, issue_key: str, fields: str) -> dict[str, Any] | None:
        url = f'{self._api(base_url)}/issues/{issue_key}'
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(url, params={'fields': fields}, headers=self._headers(token))
        except Exception as exc:
            logger.info('YouTrack issue fetch network error for %s: %s', issue_key, exc)
            return None
        if resp.status_code != 200:
            logger.info('YouTrack issue fetch HTTP %s for %s', resp.status_code, issue_key)
            return None
        return resp.json() or {}

    async def fetch_issue_fields(
        self, *, cfg: dict[str, str] | None, issue_key: str,
    ) -> dict[str, Any] | None:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        if not base_url or not key:
            return None
        issue = await self._get_issue(
            base_url=base_url, token=token, issue_key=key,
            fields='summary,description,customFields(name,value(name,login,fullName))',
        )
        if issue is None:
            return None
        assignee = self._cf_value(issue, 'Assignee')
        return {
            'title': str(issue.get('summary') or '').strip(),
            'description': str(issue.get('description') or ''),
            'state': self._cf_name(self._cf_value(issue, 'State', 'Stage')),
            'assigned_to': self._user_label(assignee),
        }

    async def fetch_issue_match_fields(
        self, *, cfg: dict[str, str] | None, issue_key: str,
    ) -> dict[str, Any] | None:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        if not base_url or not key:
            return None
        issue = await self._get_issue(
            base_url=base_url, token=token, issue_key=key,
            fields='summary,project(shortName,name),reporter(login,fullName,email),tags(name),'
                   'customFields(name,value(name))',
        )
        if issue is None:
            return None
        project = issue.get('project') if isinstance(issue.get('project'), dict) else {}
        reporter = issue.get('reporter') if isinstance(issue.get('reporter'), dict) else {}
        tags = [str((t or {}).get('name') or '').strip() for t in (issue.get('tags') or [])]
        return {
            'title': str(issue.get('summary') or '').strip(),
            'project': str((project or {}).get('shortName') or (project or {}).get('name') or '').strip(),
            'issue_type': self._cf_name(self._cf_value(issue, 'Type')),
            'reporter_name': str((reporter or {}).get('fullName') or '').strip(),
            'reporter_email': str((reporter or {}).get('email') or '').strip(),
            'labels': [t for t in tags if t],
        }

    async def fetch_issue_comments(
        self, *, cfg: dict[str, str] | None, issue_key: str,
    ) -> list[dict[str, Any]]:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        if not base_url or not key:
            return []
        url = f'{self._api(base_url)}/issues/{key}/comments'
        params = {'fields': 'id,text,created,author(fullName,login)', '$top': 50}
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url, params=params, headers=self._headers(token))
            if resp.status_code != 200:
                return []
            rows = resp.json() or []
        out: list[dict[str, Any]] = []
        for c in rows:
            if not isinstance(c, dict):
                continue
            author = c.get('author') if isinstance(c.get('author'), dict) else {}
            created = c.get('created')
            out.append({
                'id': c.get('id'),
                'text': str(c.get('text') or ''),
                'created_by': str((author or {}).get('fullName') or (author or {}).get('login') or ''),
                'created_at': self._epoch_to_iso(created),
            })
        # YouTrack returns oldest-first; flip to newest-first to match Jira.
        out.reverse()
        return out

    async def fetch_issue_images(
        self,
        issue_key: str,
        *,
        cfg: dict[str, str] | None = None,
        max_images: int = 6,
    ) -> list[tuple[str, bytes, str]]:
        return await self._fetch_attachments(issue_key, cfg=cfg, max_files=max_images, want_images=True)

    async def fetch_issue_attachments(
        self,
        issue_key: str,
        cfg: dict[str, str] | None = None,
        *,
        max_files: int = 6,
        max_bytes_per_file: int = 8 * 1024 * 1024,
    ) -> list[tuple[str, bytes, str]]:
        return await self._fetch_attachments(
            issue_key, cfg=cfg, max_files=max_files,
            want_images=False, max_bytes_per_file=max_bytes_per_file,
        )

    async def _fetch_attachments(
        self,
        issue_key: str,
        *,
        cfg: dict[str, str] | None,
        max_files: int,
        want_images: bool,
        max_bytes_per_file: int = 8 * 1024 * 1024,
    ) -> list[tuple[str, bytes, str]]:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        if not base_url or not key:
            return []
        host = self._host(base_url)
        url = f'{self._api(base_url)}/issues/{key}/attachments'
        params = {'fields': 'name,url,mimeType,size', '$top': 50}
        results: list[tuple[str, bytes, str]] = []
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            try:
                resp = await client.get(url, params=params, headers=self._headers(token))
            except Exception as exc:
                logger.info('YouTrack attachment list failed for %s: %s', key, exc)
                return []
            if resp.status_code != 200:
                return []
            for att in resp.json() or []:
                if len(results) >= max_files or not isinstance(att, dict):
                    continue
                name = str(att.get('name') or '').strip()
                rel = str(att.get('url') or '').strip()
                mime = str(att.get('mimeType') or '').split(';')[0].strip().lower()
                if not rel:
                    continue
                is_image = mime.startswith('image/')
                if want_images and not is_image:
                    continue
                if not want_images and is_image:
                    continue  # images handled by fetch_issue_images
                size = int(att.get('size') or 0)
                if size and size > max_bytes_per_file:
                    continue
                file_url = rel if rel.startswith('http') else f'{host}{rel}'
                try:
                    bin_resp = await client.get(file_url, headers={'Authorization': f'Bearer {token}'})
                except Exception as exc:
                    logger.info('YouTrack attachment download failed for %s: %s', name, exc)
                    continue
                if bin_resp.status_code != 200 or len(bin_resp.content) > max_bytes_per_file:
                    continue
                if not name:
                    name = f'youtrack-attachment-{len(results) + 1}'
                results.append((name, bin_resp.content, mime or 'application/octet-stream'))
        return results

    # ── writes ──────────────────────────────────────────────────────────
    async def _run_command(
        self, *, base_url: str, token: str, issue_key: str, query: str, comment: str | None = None,
    ) -> bool:
        """Apply a YouTrack command to a single issue. Returns True on success.
        Used for state transitions, assignee changes, tags and field updates —
        YouTrack does not allow direct field PUTs for workflow-managed fields."""
        url = f'{self._api(base_url)}/commands'
        payload: dict[str, Any] = {'query': query, 'issues': [{'idReadable': issue_key}]}
        if comment:
            payload['comment'] = comment
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=payload, headers=self._headers(token))
            if resp.status_code >= 400:
                logger.info('YouTrack command %r failed for %s: %s', query, issue_key, resp.text[:200])
                return False
        return True

    async def transition_issue(
        self, *, cfg: dict[str, str] | None, issue_key: str, target_status: str,
    ) -> str | None:
        """Move an issue to the named state via the ``State`` command.
        Returns the applied target name on success, ``None`` otherwise — the
        workflow-sync layer treats ``None`` as a soft miss and tries the next
        candidate name."""
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        target = str(target_status or '').strip()
        if not base_url or not key or not target:
            return None
        ok = await self._run_command(
            base_url=base_url, token=token, issue_key=key, query=f'State {{{target}}}',
        )
        return target if ok else None

    async def add_comment(self, *, cfg: dict[str, str] | None, issue_key: str, text: str) -> None:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        body = str(text or '').strip()
        if not base_url or not key or not body:
            return
        url = f'{self._api(base_url)}/issues/{key}/comments'
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, params={'fields': 'id'}, json={'text': body}, headers=self._headers(token))
            resp.raise_for_status()

    async def writeback_refinement(
        self,
        *,
        cfg: dict[str, str] | None,
        issue_key: str,
        suggested_story_points: int,
        comment: str,
        board_id: str | None = None,
        assignee_email: str | None = None,
    ) -> None:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        if not base_url or not key:
            raise ValueError('YouTrack base_url or issue key is missing')

        sp = int(suggested_story_points or 0)
        if sp > 0:
            # Story-point field naming varies by instance; try the common ones.
            for field_name in ('Story points', 'Estimation', 'Story Points'):
                if await self._run_command(
                    base_url=base_url, token=token, issue_key=key, query=f'{field_name} {sp}',
                ):
                    break

        comment_text = str(comment or '').strip()
        if comment_text:
            await self.add_comment(cfg=cfg, issue_key=key, text=comment_text)

        assignee = (assignee_email or '').strip()
        if assignee:
            await self._run_command(
                base_url=base_url, token=token, issue_key=key, query=f'Assignee {assignee}',
            )

    async def add_label_to_issue(self, *, cfg: dict[str, str] | None, issue_key: str, label: str) -> None:
        base_url, token = self._resolve_config(cfg)
        key = str(issue_key or '').strip()
        value = str(label or '').strip()
        if not base_url or not key or not value:
            return
        await self._run_command(
            base_url=base_url, token=token, issue_key=key, query=f'tag {{{value}}}',
        )

    async def create_issue(
        self,
        *,
        cfg: dict[str, str] | None,
        project_key: str,
        summary: str,
        description: str = '',
        issue_type: str = 'Bug',
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create an issue in the given project (by shortName). Type and tags
        are applied via commands after creation, since the create endpoint
        only sets project/summary/description."""
        base_url, token = self._resolve_config(cfg)
        key = str(project_key or '').strip()
        if not base_url or not key or not summary:
            raise ValueError('YouTrack base_url, project_key and summary are required')

        project_id = await self._resolve_project_id(base_url=base_url, token=token, short_name=key)
        if not project_id:
            raise ValueError(f'YouTrack project not found: {key}')

        url = f'{self._api(base_url)}/issues'
        body = {
            'project': {'id': project_id},
            'summary': summary[:255],
            'description': description or '',
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url, params={'fields': 'id,idReadable'}, json=body, headers=self._headers(token),
            )
            resp.raise_for_status()
            created = resp.json() or {}

        issue_key = created.get('idReadable')
        if issue_key:
            if issue_type:
                await self._run_command(
                    base_url=base_url, token=token, issue_key=issue_key, query=f'Type {{{issue_type}}}',
                )
            for lbl in labels or []:
                if str(lbl).strip():
                    await self._run_command(
                        base_url=base_url, token=token, issue_key=issue_key,
                        query=f'tag {{{str(lbl).strip()}}}',
                    )
            # Surface a Jira-shaped result so callers can read ['key'].
            created['key'] = issue_key
        return created

    async def _resolve_project_id(self, *, base_url: str, token: str, short_name: str) -> str | None:
        url = f'{self._api(base_url)}/admin/projects'
        params = {'fields': 'id,shortName', '$top': 1000}
        async with httpx.AsyncClient(timeout=20) as client:
            try:
                resp = await client.get(url, params=params, headers=self._headers(token))
                resp.raise_for_status()
                rows = resp.json() or []
            except httpx.HTTPError:
                return None
        for p in rows:
            if isinstance(p, dict) and str(p.get('shortName') or '').strip().lower() == short_name.lower():
                return str(p.get('id') or '') or None
        return None

    async def fetch_dev_info(
        self, cfg: dict[str, str], *, issue_id: str, concurrency_note: str = '',
    ) -> dict[str, Any]:
        """YouTrack exposes VCS changes via a separate optional integration.
        We return the empty shape so the importer's enrichment step is a no-op
        rather than guessing at branch/PR data we can't reliably resolve."""
        return {
            'branches': [], 'pr_titles': [], 'pr_count': 0, 'commit_count': 0,
            'primary_pr_url': None, 'primary_branch_name': None,
        }

    # ── parsing helpers ─────────────────────────────────────────────────
    def _to_external_task(self, issue: dict[str, Any], *, base_url: str | None = None) -> ExternalTask:
        key = issue.get('idReadable') or str(issue.get('id') or '')
        project = issue.get('project') if isinstance(issue.get('project'), dict) else {}
        reporter = issue.get('reporter') if isinstance(issue.get('reporter'), dict) else {}
        tags = [str((t or {}).get('name') or '').strip() for t in (issue.get('tags') or [])]
        assignee = self._cf_value(issue, 'Assignee')
        return ExternalTask(
            id=key,
            internal_id=str(issue.get('id')) if issue.get('id') is not None else None,
            title=str(issue.get('summary') or ''),
            description=str(issue.get('description') or ''),
            source='youtrack',
            state=self._cf_name(self._cf_value(issue, 'State', 'Stage')) or None,
            assigned_to=self._user_label(assignee) or None,
            created_date=self._epoch_to_iso(issue.get('created')),
            closed_date=self._epoch_to_iso(issue.get('resolved')),
            story_points=self._coerce_float(self._cf_value(issue, 'Story points', 'Estimation', 'Story Points')),
            reporter_email=str((reporter or {}).get('email') or '').strip() or None,
            reporter_name=str((reporter or {}).get('fullName') or '').strip() or None,
            issue_type=self._cf_name(self._cf_value(issue, 'Type')) or None,
            project_key=str((project or {}).get('shortName') or '').strip() or None,
            labels=[t for t in tags if t],
            web_url=self._build_issue_url(base_url, key) if base_url else None,
        )

    @staticmethod
    def _cf_value(issue: dict[str, Any], *names: str) -> Any:
        wanted = {n.lower() for n in names}
        for cf in issue.get('customFields') or []:
            if isinstance(cf, dict) and str(cf.get('name') or '').lower() in wanted:
                return cf.get('value')
        return None

    @staticmethod
    def _cf_name(value: Any) -> str:
        if isinstance(value, dict):
            return str(value.get('name') or value.get('presentation') or '').strip()
        if isinstance(value, list) and value:
            first = value[0]
            if isinstance(first, dict):
                return str(first.get('name') or '').strip()
        return ''

    @staticmethod
    def _user_label(value: Any) -> str:
        if isinstance(value, dict):
            return str(value.get('fullName') or value.get('login') or '').strip()
        if isinstance(value, list) and value and isinstance(value[0], dict):
            return str(value[0].get('fullName') or value[0].get('login') or '').strip()
        return ''

    @staticmethod
    def _coerce_float(value: Any) -> float | None:
        if isinstance(value, dict):
            # PeriodIssueCustomField: minutes; SimpleIssueCustomField wraps numbers directly.
            value = value.get('minutes', value.get('presentation'))
        if value in (None, ''):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _epoch_to_iso(value: Any) -> str | None:
        # YouTrack timestamps are epoch milliseconds. Keep them as a string so
        # downstream handling (which only ever stringifies dates) stays uniform.
        if value in (None, ''):
            return None
        return str(value)

    def _normalize_status(self, value: str | None) -> str:
        return str(value or '').strip().casefold()

    def _build_issue_url(self, base_url: str, key: str) -> str | None:
        normalized = str(key or '').strip()
        if not normalized:
            return None
        return f'{self._host(base_url)}/issue/{normalized}'
