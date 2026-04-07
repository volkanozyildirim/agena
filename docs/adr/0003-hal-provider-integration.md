# ADR-0003: HAL AI Provider Integration for Sprint Refinement

- **Status:** Accepted
- **Date:** 2026-04-08
- **Deciders:** Obfox

---

## Context

Sprint Refinement analysis was limited to two LLM providers: OpenAI and Gemini. Both follow the OpenAI-compatible API contract and are routed through `LLMProvider`, which builds a `CrewAI` agent crew internally.

HAL is a custom internal AI service with a fundamentally different auth model:
- Session-based: the client must first POST credentials to a login endpoint and receive a short-lived JWT access token.
- The token is then sent as a Bearer header on subsequent chat requests.
- HAL does not expose an OpenAI-compatible API surface; CrewAI cannot drive it directly.

The goals were:
1. Make HAL selectable as the agent provider in the Sprint Refinement UI.
2. Handle token acquisition and 15-minute caching transparently.
3. Fit into the existing `CrewAIAgentRunner` dispatch path with minimal changes.

---

## Decision

### New class: `HalProvider`

`packages/services/src/agena_services/services/llm/hal_provider.py`

`HalProvider` is a standalone class (not a subclass of `LLMProvider`) that implements the same `generate()` signature:

```python
async def generate(
    self,
    system_prompt: str,
    user_prompt: str,
    complexity_hint: str = 'normal',
    max_output_tokens: int = 2500,
    skip_cache: bool = False,
    image_inputs: list[str] | None = None,
) -> tuple[str, dict[str, int], str, bool]:
```

It also exposes the dummy attributes `api_key`, `small_model`, `large_model`, and `provider = 'hal'` so that `CrewAIAgentRunner._select_model()` and `_normalize_crewai_model()` do not raise errors.

### Token lifecycle

| Step | Detail |
|---|---|
| Cache key | `hal_token:{organization_id}` in Redis |
| TTL | 900 seconds (15 minutes) |
| Acquisition | `POST {base_url}{login_endpoint}` with `{"username": ..., "password": ...}` → `detail.access_token` |
| Expiry retry | On HTTP 401, token is deleted from Redis and re-acquired once before the request is retried |
| Redis unavailable | Login is called on every request; operation continues without caching |

### CrewAI bypass

`CrewAIAgentRunner._run_with_crewai_or_llm()` already had a `use_direct_llm` flag for Codex models. HAL is added to the same condition:

```python
use_direct_llm = 'codex' in crewai_model.lower() or getattr(self.llm, 'provider', '') == 'hal'
```

When `use_direct_llm` is `True` the runner skips CrewAI entirely and calls `self.llm.generate()` directly with the assembled system and user prompts.

### Provider resolution

`RefinementService._resolve_llm()` now accepts `'hal'` as a valid provider. When selected it:
1. Reads `IntegrationConfig` for provider `'hal'`.
2. Uses `base_url` as the HAL service root URL.
3. Reads `login_url` and `chat_url` from `extra_config` (defaults: `/auth/login`, `/api/chat`).
4. Returns a `HalProvider` instance instead of `LLMProvider`.

### Credential storage

HAL credentials are stored in `integration_configs` using the following mapping:

| `integration_configs` column | HAL concept |
|---|---|
| `base_url` | Service root URL |
| `username` | Login username |
| `secret` | Login password (masked in API responses) |
| `extra_config.login_url` | Login endpoint path |
| `extra_config.chat_url` | Chat endpoint path |

### Frontend

- `AgentProvider` type extended to `'openai' | 'gemini' | 'hal'`.
- Provider dropdown in Sprint Refinement settings shows **HAL** as a third option.
- When HAL is selected: model selector and Available Models panel are hidden (HAL has no selectable model).
- HAL integration form lives in the **AI** tab of `/dashboard/integrations`.

---

## Consequences

### Positive

- HAL plugs into the existing refinement pipeline without changes to prompt construction, result parsing, or writeback logic.
- Token caching avoids a login round-trip on every item; the 15-minute TTL matches HAL's token lifetime.
- Automatic 401 retry makes token expiry transparent to callers.
- The `use_direct_llm` pattern was already established for Codex; HAL reuses it cleanly.

### Negative / Risks

- `HalProvider` is not typed as `LLMProvider` — the `CrewAIAgentRunner` constructor type hint (`LLMProvider | None`) is technically violated. Duck typing works at runtime; a Protocol or ABC would make this explicit.
- HAL token usage (prompt/completion tokens) is not reported — refinement cost tracking shows `0` tokens for HAL runs.
- The chat request payload is fixed to `{"message": "<combined_prompt>"}`. If HAL's API evolves to require a different shape, `HalProvider.generate()` must be updated.
- A Redis outage causes one extra login request per refinement item (performance degradation, not a failure).

---

## Alternatives Considered

**Extend `LLMProvider` with a HAL branch** — add `elif self.provider == 'hal'` inside `LLMProvider.generate()`. Rejected: HAL's token-management state (Redis key, organization_id) does not belong in a class designed around stateless API key auth.

**Make HAL OpenAI-compatible via a proxy** — wrap HAL behind an adapter that speaks the OpenAI chat completions API so CrewAI can drive it natively. Rejected: adds infrastructure complexity; HAL's session-based auth makes the adapter non-trivial to implement safely.

**Run HAL calls through the Redis worker queue** — async task dispatch. Rejected: Sprint Refinement analysis already runs synchronously in the API process (not via the worker queue); introducing async dispatch for a single provider would be inconsistent with the rest of the refinement flow.
