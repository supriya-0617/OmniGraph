"""GraphRAG forensic analyst (docs/06_GRAPHRAG.md)."""
from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.ai.context import build_context, serialize_context
from app.ai.llm_client import LLMAdapterError, llm_client
from app.ai.prompts import SYSTEM_PROMPT, build_user_prompt
from app.auth.dependencies import get_current_account
from app.config import settings
from app.routes.analytics import compute_clusters
from app.routes.graph import get_graph
from app.schemas.ai import AIQueryRequest, AIQueryResponse, AIStatus, AnalysisContext, ModelAnalysis

logger = logging.getLogger("omnigraph.routes.ai")

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_account)])

MAX_DISCARD_RATIO = 0.5


class _RateLimiter:
    """Sliding one-minute window per analyst account; protects the provider key from abuse."""

    def __init__(self):
        self._calls: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int) -> float | None:
        now = time.monotonic()
        with self._lock:
            calls = self._calls[key]
            while calls and now - calls[0] > 60:
                calls.popleft()
            if limit > 0 and len(calls) >= limit:
                return 60 - (now - calls[0])
            calls.append(now)
            return None


rate_limiter = _RateLimiter()


@router.get("/status", response_model=AIStatus)
def ai_status():
    return llm_client.status()


@router.post("/query", response_model=AIQueryResponse)
def query_ai(request: AIQueryRequest, account: dict = Depends(get_current_account)):
    graph = get_graph(request.filters)
    if not graph.get("nodes"):
        return AIQueryResponse(
            summary="No graph evidence matches the current dashboard filters, so there is nothing to analyse.",
            likely_origin_node_id=None,
            coordination_flags=[],
            evidence_node_ids=[],
            missing_evidence=["Widen the date range, lower the severity threshold or reduce the density filter."],
            confidence="low",
            confidence_note="The selected filters returned an empty graph; no model call was made.",
            context=AnalysisContext(
                nodes_in_filter=0, nodes_analyzed=0, edges_analyzed=0,
                clusters_considered=0, detector_findings=0, truncated=False,
            ),
        )

    account_id = str(account.get("user_id", "anonymous")) if isinstance(account, dict) else "anonymous"
    retry_after = rate_limiter.check(account_id, settings.AI_RATE_LIMIT_PER_MINUTE)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"AI query limit reached ({settings.AI_RATE_LIMIT_PER_MINUTE}/min). Try again in {int(retry_after) + 1}s.",
            headers={"Retry-After": str(int(retry_after) + 1)},
        )

    clusters = compute_clusters(request.filters)
    context = build_context(graph, clusters, request.focus_node_ids)
    user_prompt = build_user_prompt(
        serialize_context(context), request.question, [turn.model_dump() for turn in request.history]
    )

    try:
        result = llm_client.generate_forensic_analysis(SYSTEM_PROMPT, user_prompt)
    except LLMAdapterError as error:
        logger.warning("GraphRAG provider failure: %s", error)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    try:
        analysis = ModelAnalysis.model_validate(result.data)
    except ValidationError as error:
        logger.warning("Model returned invalid schema: %s", error.errors()[:3])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an analysis that did not match the expected structure. Please retry.",
        ) from error

    return _ground(analysis, context, result)


def _ground(analysis: ModelAnalysis, context, result) -> AIQueryResponse:
    """Keep only evidence that exists in the analysed sub-graph; disclose anything removed."""
    citable = context.citable_ids
    discarded: set[str] = set()

    def keep(ids: list[str]) -> list[str]:
        kept = []
        for node_id in dict.fromkeys(str(raw).strip() for raw in ids):
            if not node_id:
                continue
            if node_id in citable:
                kept.append(node_id)
            else:
                discarded.add(node_id)
        return kept

    flags = [flag.model_copy(update={"evidence_node_ids": keep(flag.evidence_node_ids)}) for flag in analysis.coordination_flags]
    evidence = keep(analysis.evidence_node_ids)[:40]
    origin = analysis.likely_origin_node_id
    note = analysis.confidence_note
    if origin and origin not in citable:
        discarded.add(origin)
        origin = None
        note += " (The model proposed an origin node that is not in the analysed sub-graph; it was removed.)"

    referenced = len(discarded) + len(evidence) + sum(len(flag.evidence_node_ids) for flag in flags)
    if discarded and len(discarded) >= 3 and len(discarded) / max(referenced, 1) > MAX_DISCARD_RATIO:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI cited mostly node IDs that are not in the filtered graph, so the answer was rejected. Please retry.",
        )
    if origin and origin not in evidence:
        evidence.insert(0, origin)

    return AIQueryResponse(
        **analysis.model_dump(exclude={"coordination_flags", "evidence_node_ids", "likely_origin_node_id", "confidence_note"}),
        likely_origin_node_id=origin,
        coordination_flags=flags,
        evidence_node_ids=evidence,
        confidence_note=note,
        discarded_node_ids=sorted(discarded),
        context=AnalysisContext(
            nodes_in_filter=context.nodes_in_filter,
            nodes_analyzed=len(context.nodes),
            edges_analyzed=len(context.edges),
            clusters_considered=len(context.clusters),
            detector_findings=len(context.findings),
            truncated=context.truncated,
            focus_node_ids=context.focus_node_ids,
            provider=result.provider,
            model=result.model,
            latency_ms=result.latency_ms,
        ),
    )
