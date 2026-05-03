"""Public-skills importer.

Walks one or more GitHub repositories, finds every `SKILL.md` file, parses
its YAML frontmatter + markdown body, and inserts each as a public Skill
row (organization_id NULL, is_public=True, source='public_import').

Why baked into AGENA's DB instead of a runtime fetch from the upstream
catalog: tenants don't depend on third-party uptime, the embedding step
runs once at import (so retrieval at agent runtime is purely local), and
admins can flip individual skills off if they don't apply to the team's
stack.

The importer is idempotent — `external_url` is unique, so re-running on
the same repo updates titles / descriptions / fragments without
duplicating rows.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agena_models.models.skill import Skill

logger = logging.getLogger(__name__)


# A modest seed list of repos that publish skills directly. The admin UI
# can add more via the import endpoint at any time.
DEFAULT_REPOS = [
    'anthropics/skills',
    'vercel/best-practices-skills',
    'cloudflare/skills',
    'sentry/skills',
    'firebase/skills',
    'stripe/skills',
]


_FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
# Crude YAML key:value parser — keeps the importer self-contained
_KV_RE = re.compile(r'^([a-zA-Z0-9_-]+)\s*:\s*(.+?)\s*$', re.MULTILINE)


def _parse_skill_md(text: str) -> dict[str, Any]:
    """Extract YAML frontmatter + body from a SKILL.md file.

    The official format only requires `name` and `description`; everything
    else (tags, model, allowed-tools, …) is treated as optional metadata.
    The body markdown becomes the prompt fragment that gets injected into
    agent system prompts at runtime.
    """
    out: dict[str, Any] = {'name': '', 'description': '', 'tags': [], 'body': text}
    m = _FRONTMATTER_RE.match(text or '')
    if not m:
        return out
    fm = m.group(1)
    body = text[m.end():].strip()
    out['body'] = body
    for k, v in _KV_RE.findall(fm):
        v = v.strip()
        if v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        elif v.startswith("'") and v.endswith("'"):
            v = v[1:-1]
        if k.lower() == 'tags':
            # accept "[a, b, c]" or "a, b, c"
            v = v.strip('[]')
            out['tags'] = [t.strip() for t in v.split(',') if t.strip()]
        else:
            out[k.lower()] = v
    return out


async def _list_skill_md_paths(client: httpx.AsyncClient, repo: str, branch: str = 'main') -> list[str]:
    """GitHub Trees API — get every SKILL.md in the repo in a single call."""
    # Try main, then master if that 404s
    for b in (branch, 'master'):
        url = f'https://api.github.com/repos/{repo}/git/trees/{b}?recursive=1'
        try:
            r = await client.get(url, timeout=30, headers={'Accept': 'application/vnd.github+json'})
        except Exception:
            continue
        if r.status_code == 200:
            tree = r.json().get('tree') or []
            return [
                node['path'] for node in tree
                if node.get('type') == 'blob'
                and node.get('path', '').endswith('SKILL.md')
            ]
    return []


async def _fetch_raw(client: httpx.AsyncClient, repo: str, path: str, branch: str) -> str | None:
    url = f'https://raw.githubusercontent.com/{repo}/{branch}/{path}'
    try:
        r = await client.get(url, timeout=30)
    except Exception:
        return None
    if r.status_code != 200:
        return None
    return r.text


async def import_repo(
    db: AsyncSession,
    repo: str,
    *,
    branch: str = 'main',
    concurrency: int = 6,
) -> dict[str, int]:
    """Walk one GitHub repo, upsert every SKILL.md it contains.

    Returns counts {found, inserted, updated, skipped}."""
    counts = {'found': 0, 'inserted': 0, 'updated': 0, 'skipped': 0}
    async with httpx.AsyncClient() as client:
        paths = await _list_skill_md_paths(client, repo, branch=branch)
        if not paths:
            # Try master — github default branch sometimes differs
            for fallback in ('master', 'develop'):
                if fallback == branch:
                    continue
                paths = await _list_skill_md_paths(client, repo, branch=fallback)
                if paths:
                    branch = fallback
                    break
        counts['found'] = len(paths)
        if not paths:
            logger.info('skill-import: %s — no SKILL.md found', repo)
            return counts

        # Two phases: fetch all SKILL.md texts in parallel (network is the
        # bottleneck), then write to DB sequentially (AsyncSession is not
        # safe under concurrent use — sharing one session across many
        # awaiters trips IllegalStateChangeError).
        sem = asyncio.Semaphore(concurrency)
        async def fetch_one(p: str) -> tuple[str, str | None]:
            async with sem:
                return p, await _fetch_raw(client, repo, p, branch)
        fetched = await asyncio.gather(*(fetch_one(p) for p in paths))

        for p, text in fetched:
            if not text:
                counts['skipped'] += 1
                continue
            meta = _parse_skill_md(text)
            if not meta.get('name'):
                counts['skipped'] += 1
                continue
            external_url = f'https://github.com/{repo}/blob/{branch}/{p}'
            existing = (
                await db.execute(select(Skill).where(Skill.external_url == external_url))
            ).scalar_one_or_none()
            description = (meta.get('description') or meta.get('summary') or '')[:1024]
            tags = meta.get('tags') or []
            if not isinstance(tags, list):
                tags = []
            slug = p.split('/')[-2] if '/' in p else meta.get('name', '')
            pattern_type = (meta.get('pattern_type') or meta.get('category') or 'other').lower()
            body = meta.get('body') or ''

            if existing is None:
                db.add(Skill(
                    organization_id=None,
                    source_task_id=None,
                    created_by_user_id=None,
                    name=meta.get('name', slug)[:256],
                    description=description,
                    pattern_type=pattern_type[:48],
                    tags=tags,
                    touched_files=[],
                    approach_summary=description,
                    prompt_fragment=body,
                    is_public=True,
                    is_active=True,
                    source='public_import',
                    external_url=external_url,
                    publisher=repo,
                ))
                counts['inserted'] += 1
            else:
                existing.name = meta.get('name', existing.name)[:256]
                existing.description = description
                existing.pattern_type = pattern_type[:48]
                existing.tags = tags
                existing.approach_summary = description
                existing.prompt_fragment = body
                existing.is_public = True
                existing.source = 'public_import'
                existing.publisher = repo
                counts['updated'] += 1

        await db.commit()

    logger.info('skill-import: %s — %s', repo, counts)
    return counts


async def import_default_set(db: AsyncSession) -> dict[str, dict[str, int]]:
    """One-shot helper: walk every repo in DEFAULT_REPOS. Used by the admin
    "Import public library" button and by the seed runner."""
    out: dict[str, dict[str, int]] = {}
    for repo in DEFAULT_REPOS:
        try:
            out[repo] = await import_repo(db, repo)
        except Exception:
            logger.exception('skill-import failed for %s', repo)
            out[repo] = {'found': 0, 'inserted': 0, 'updated': 0, 'skipped': 0, 'error': 1}  # type: ignore[dict-item]
    return out
