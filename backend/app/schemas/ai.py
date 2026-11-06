from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.filters import GraphFilters

Strength = Literal["strong", "moderate", "weak"]
Confidence = Literal["low", "medium", "high"]


class ConversationTurn(BaseModel):
    question: str = Field(max_length=2000)
    summary: str = Field(max_length=4000)


class AIQueryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filters: GraphFilters = Field(default_factory=GraphFilters)
    question: str = Field(min_length=3, max_length=2000)
    focus_node_ids: list[str] = Field(
        default_factory=list,
        max_length=60,
        description="Nodes the analyst is focused on (selected cluster or node); prioritised in the sub-graph.",
    )
    history: list[ConversationTurn] = Field(
        default_factory=list, max_length=6, description="Previous turns, oldest first, for follow-up questions."
    )

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 3:
            raise ValueError("question must contain at least 3 non-whitespace characters")
        return normalized


class CoordinationFlag(BaseModel):
    model_config = ConfigDict(extra="ignore")

    signal: str = Field(min_length=1)
    details: str = Field(min_length=1)
    evidence_node_ids: list[str] = Field(default_factory=list)
    strength: Strength = "moderate"

    @field_validator("strength", mode="before")
    @classmethod
    def normalize_strength(cls, value):
        value = str(value or "moderate").lower().strip()
        return value if value in {"strong", "moderate", "weak"} else "moderate"


class ModelAnalysis(BaseModel):
    """Shape the LLM must return (validated before anything reaches the client)."""

    model_config = ConfigDict(extra="ignore")

    summary: str = Field(min_length=1)
    likely_origin_node_id: str | None = None
    origin_rationale: str | None = None
    coordination_flags: list[CoordinationFlag] = Field(default_factory=list)
    evidence_node_ids: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    confidence: Confidence = "low"
    confidence_note: str = Field(min_length=1)

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value):
        value = str(value or "low").lower().strip()
        return value if value in {"low", "medium", "high"} else "low"

    @field_validator("likely_origin_node_id", mode="before")
    @classmethod
    def normalize_origin(cls, value):
        if value is None or (isinstance(value, str) and value.strip().lower() in {"", "null", "none", "unknown"}):
            return None
        return str(value).strip()


class AnalysisContext(BaseModel):
    nodes_in_filter: int
    nodes_analyzed: int
    edges_analyzed: int
    clusters_considered: int
    detector_findings: int
    truncated: bool
    focus_node_ids: list[str] = Field(default_factory=list)
    provider: str | None = None
    model: str | None = None
    latency_ms: int | None = None


class AIQueryResponse(ModelAnalysis):
    discarded_node_ids: list[str] = Field(
        default_factory=list,
        description="IDs the model cited that are not in the analysed sub-graph; removed from evidence.",
    )
    context: AnalysisContext | None = None


class AIStatus(BaseModel):
    configured: bool
    provider: str
    model: str
    detail: str | None = None
