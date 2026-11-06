"""The ONLY module that talks to an LLM provider (AGENTS.md rule 3).

Switch providers with environment variables — no code changes:

=============  ==================================================  ==============================
LLM_PROVIDER   Credentials                                         Default LLM_MODEL
=============  ==================================================  ==============================
gemini         LLM_API_KEY from Google AI Studio                    gemini-3.8-flash
vertex         Vertex AI (bills Google Cloud credits, e.g. the      gemini-3.8-flash
               $300 trial). Either LLM_API_KEY (Vertex API key)
               or GOOGLE_APPLICATION_CREDENTIALS + VERTEX_PROJECT_ID
openai         LLM_API_KEY; LLM_BASE_URL for any OpenAI-compatible  (required)
               endpoint (OpenRouter, Groq, Ollama, …)
anthropic      LLM_API_KEY                                          claude-sonnet-5-5
=============  ==================================================  ==============================

For the strongest reasoning set ``LLM_MODEL=gemini-4-argon`` (slower; raise
``LLM_TIMEOUT_SECONDS`` to ~90).

Failures raise :class:`LLMAdapterError` with a human-readable message; this module
never fabricates an answer.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.config import settings

logger = logging.getLogger("omnigraph.ai")

DEFAULT_MODELS = {
    "gemini": "gemini-3.8-flash",
    "vertex": "gemini-3.8-flash",
    "anthropic": "claude-sonnet-5-5",
    "openai": "",
}
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class LLMAdapterError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = False, status: int | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.status = status


@dataclass
class LLMResult:
    data: dict[str, Any]
    provider: str
    model: str
    latency_ms: int


class LLMAdapter:
    def __init__(self, provider: str | None = None, api_key: str | None = None, model: str | None = None):
        self._provider = provider
        self._api_key = api_key
        self._model = model

    # Read settings lazily so tests and hot env changes see current values.
    @property
    def provider(self) -> str:
        return (self._provider or settings.LLM_PROVIDER or "gemini").strip().lower()

    @property
    def api_key(self) -> str:
        return self._api_key if self._api_key is not None else settings.LLM_API_KEY

    @property
    def model(self) -> str:
        return self._model or settings.LLM_MODEL or DEFAULT_MODELS.get(self.provider, "")

    # ------------------------------------------------------------------ status
    def status(self) -> dict[str, Any]:
        problem = self._configuration_problem()
        return {"configured": problem is None, "provider": self.provider, "model": self.model, "detail": problem}

    def _configuration_problem(self) -> str | None:
        if self.provider not in DEFAULT_MODELS:
            return f"Unknown LLM_PROVIDER '{self.provider}'. Use gemini, vertex, openai or anthropic."
        if not self.model:
            return f"LLM_MODEL is required for provider '{self.provider}'."
        if self.provider == "vertex":
            if self.api_key or (settings.GOOGLE_APPLICATION_CREDENTIALS and settings.VERTEX_PROJECT_ID):
                return None
            return "Vertex AI needs LLM_API_KEY, or GOOGLE_APPLICATION_CREDENTIALS plus VERTEX_PROJECT_ID."
        if not self.api_key:
            return "LLM_API_KEY is not configured on the server."
        return None

    # ------------------------------------------------------------------ public API
    def generate_forensic_analysis(self, system_prompt: str, user_prompt: str) -> LLMResult:
        problem = self._configuration_problem()
        if problem:
            raise LLMAdapterError(problem)
        started = time.monotonic()
        call = {
            "gemini": self._call_gemini,
            "vertex": self._call_vertex,
            "openai": self._call_openai,
            "anthropic": self._call_anthropic,
        }[self.provider]
        try:
            text = call(system_prompt, user_prompt)
        except LLMAdapterError as error:
            if not error.retryable:
                raise
            logger.warning("LLM call failed (%s); retrying once", error)
            time.sleep(1.5)
            text = call(system_prompt, user_prompt)
        latency = int((time.monotonic() - started) * 1000)
        logger.info("GraphRAG analysis via %s/%s in %d ms", self.provider, self.model, latency)
        return LLMResult(parse_json_response(text), self.provider, self.model, latency)

    # ------------------------------------------------------------------ providers
    def _gemini_body(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        return {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
                "maxOutputTokens": settings.LLM_MAX_OUTPUT_TOKENS,
            },
        }

    def _call_gemini(self, system_prompt: str, user_prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(self.model)}:generateContent"
        payload = _post_json(url, self._gemini_body(system_prompt, user_prompt), {"x-goog-api-key": self.api_key})
        return _gemini_text(payload)

    def _call_vertex(self, system_prompt: str, user_prompt: str) -> str:
        location = settings.VERTEX_LOCATION or "global"
        host = "aiplatform.googleapis.com" if location == "global" else f"{location}-aiplatform.googleapis.com"
        model = quote(self.model)
        headers: dict[str, str] = {}
        if settings.GOOGLE_APPLICATION_CREDENTIALS and settings.VERTEX_PROJECT_ID:
            headers["Authorization"] = f"Bearer {_google_access_token()}"
        else:
            headers["x-goog-api-key"] = self.api_key
        if settings.VERTEX_PROJECT_ID:
            url = (f"https://{host}/v1/projects/{quote(settings.VERTEX_PROJECT_ID)}/locations/{quote(location)}"
                   f"/publishers/google/models/{model}:generateContent")
        else:  # Vertex AI API key ("express") endpoint
            url = f"https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent"
        payload = _post_json(url, self._gemini_body(system_prompt, user_prompt), headers)
        return _gemini_text(payload)

    def _call_openai(self, system_prompt: str, user_prompt: str) -> str:
        base = (settings.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        payload = _post_json(
            f"{base}/chat/completions",
            {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
            },
            {"Authorization": f"Bearer {self.api_key}"},
        )
        try:
            choice = payload["choices"][0]
            if choice.get("finish_reason") == "length":
                raise LLMAdapterError("LLM output was truncated. Increase the model's output limit.")
            return choice["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMAdapterError("LLM provider returned no analysis content.") from error

    def _call_anthropic(self, system_prompt: str, user_prompt: str) -> str:
        payload = _post_json(
            "https://api.anthropic.com/v1/messages",
            {
                "model": self.model,
                "max_tokens": settings.LLM_MAX_OUTPUT_TOKENS,
                "system": system_prompt,
                "messages": [{"role": "user", "content": user_prompt}],
            },
            {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
        )
        if payload.get("stop_reason") == "max_tokens":
            raise LLMAdapterError("LLM output was truncated. Increase LLM_MAX_OUTPUT_TOKENS.")
        text = "".join(block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text")
        if not text:
            raise LLMAdapterError("LLM provider returned no analysis content.")
        return text


# ---------------------------------------------------------------------- helpers
def _post_json(url: str, body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    request = Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "OmniGraph/1.0", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.LLM_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = _provider_error_detail(error)
        if error.code in (401, 403):
            message = "The LLM provider rejected the API credentials (check LLM_API_KEY / project access)."
        elif error.code == 404:
            message = f"Model not found or not enabled for this key: {detail or 'check LLM_MODEL'}."
        elif error.code == 429:
            message = "LLM provider rate limit or quota exceeded. Try again shortly."
        else:
            message = f"LLM provider error ({error.code}){': ' + detail if detail else ''}."
        raise LLMAdapterError(message, retryable=error.code in RETRYABLE_STATUS, status=error.code) from error
    except (URLError, TimeoutError) as error:
        raise LLMAdapterError(
            f"LLM provider timed out or could not be reached (timeout {settings.LLM_TIMEOUT_SECONDS:.0f}s).",
            retryable=True,
        ) from error
    except (OSError, json.JSONDecodeError) as error:
        raise LLMAdapterError("LLM provider returned an unreadable response.") from error


def _provider_error_detail(error: HTTPError) -> str:
    try:
        payload = json.loads(error.read().decode("utf-8"))
        message = payload.get("error", {}).get("message") if isinstance(payload.get("error"), dict) else payload.get("error")
        return str(message or "")[:240]
    except Exception:
        return ""


def _gemini_text(payload: dict[str, Any]) -> str:
    feedback = payload.get("promptFeedback", {})
    if feedback.get("blockReason"):
        raise LLMAdapterError(f"The provider blocked the request ({feedback['blockReason']}).")
    try:
        candidate = payload["candidates"][0]
    except (KeyError, IndexError, TypeError) as error:
        raise LLMAdapterError("LLM provider returned no analysis content.") from error
    finish = candidate.get("finishReason")
    if finish == "MAX_TOKENS":
        raise LLMAdapterError("LLM output was truncated. Increase LLM_MAX_OUTPUT_TOKENS.")
    if finish in {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"}:
        raise LLMAdapterError(f"The provider withheld the answer ({finish}).")
    parts = candidate.get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
    if not text.strip():
        raise LLMAdapterError("LLM provider returned no analysis content.")
    return text


def _google_access_token() -> str:
    try:
        import google.auth.transport.requests  # type: ignore
        from google.oauth2 import service_account  # type: ignore
    except ImportError as error:
        raise LLMAdapterError("Service-account auth needs the 'google-auth' package (pip install google-auth).") from error
    try:
        credentials = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        credentials.refresh(google.auth.transport.requests.Request())
        return credentials.token
    except Exception as error:
        raise LLMAdapterError(f"Could not obtain a Google Cloud access token: {error}") from error


def parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    if not cleaned.startswith("{"):
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            cleaned = cleaned[start : end + 1]
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise LLMAdapterError("LLM provider returned malformed JSON.") from error
    if not isinstance(result, dict):
        raise LLMAdapterError("LLM provider returned an invalid analysis object.")
    return result


# Backwards-compatible name used by earlier tests.
_parse_json_response = parse_json_response

llm_client = LLMAdapter()
