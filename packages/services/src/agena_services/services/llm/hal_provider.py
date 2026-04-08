from __future__ import annotations

import logging

import httpx
from redis.asyncio import Redis

from agena_core.settings import get_settings

logger = logging.getLogger(__name__)


class HalProvider:
    """HAL AI provider — token-based auth, no model selection."""

    provider = 'hal'

    def __init__(
        self,
        organization_id: int,
        base_url: str,
        login_endpoint: str,
        chat_endpoint: str,
        username: str,
        password: str,
    ) -> None:
        self.organization_id = organization_id
        self.base_url = base_url.rstrip('/')
        self.login_endpoint = login_endpoint if login_endpoint.startswith('/') else f'/{login_endpoint}'
        self.chat_endpoint = chat_endpoint if chat_endpoint.startswith('/') else f'/{chat_endpoint}'
        self.username = username
        self.password = password
        # Dummy values to satisfy CrewAIAgentRunner._select_model() interface
        self.api_key = ''
        self.small_model = 'hal'
        self.large_model = 'hal'
        self._settings = get_settings()

    def _token_redis_key(self) -> str:
        return f'hal_token:{self.organization_id}'

    async def _get_redis(self) -> Redis:
        return Redis.from_url(self._settings.redis_url, decode_responses=True)

    async def _acquire_token(self) -> str:
        """Return cached access token or fetch a fresh one from HAL login endpoint."""
        redis = await self._get_redis()
        try:
            cached = await redis.get(self._token_redis_key())
            if cached:
                return cached
        except Exception:
            pass  # Redis unavailable — proceed to login

        url = f'{self.base_url}{self.login_endpoint}'
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                json={'username': self.username, 'password': self.password},
            )
            resp.raise_for_status()
            data = resp.json()

        token: str = data['detail']['access_token']

        try:
            await redis.set(self._token_redis_key(), token, ex=900)  # 15 minutes
        except Exception:
            pass  # Redis unavailable — token won't be cached but request can proceed

        return token

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        complexity_hint: str = 'normal',
        max_output_tokens: int = 2500,
        skip_cache: bool = False,
        image_inputs: list[str] | None = None,
    ) -> tuple[str, dict[str, int], str, bool]:
        token = await self._acquire_token()

        combined_prompt = f'{system_prompt.strip()}\n\n{user_prompt.strip()}' if system_prompt.strip() else user_prompt.strip()

        url = f'{self.base_url}{self.chat_endpoint}'
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json={'message': combined_prompt},
                headers={'Authorization': f'Bearer {token}'},
            )
            if resp.status_code == 401:
                # Token expired — clear cache and retry once
                redis = await self._get_redis()
                try:
                    await redis.delete(self._token_redis_key())
                except Exception:
                    pass
                token = await self._acquire_token()
                resp = await client.post(
                    url,
                    json={'message': combined_prompt},
                    headers={'Authorization': f'Bearer {token}'},
                )
            resp.raise_for_status()
            data = resp.json()

        output: str = (
            data.get('response')
            or data.get('message')
            or data.get('content')
            or data.get('text')
            or str(data)
        )
        usage = {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}
        return output, usage, 'hal', False
