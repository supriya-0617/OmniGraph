import logging
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("omnigraph.ai")

class LLMAdapter:
    """
    Isolated adapter for GraphRAG LLM queries.
    Provider choice (Gemini / OpenAI / Anthropic) is encapsulated here per AGENTS.md.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.LLM_API_KEY
        self.provider = "gemini"  # Currently leaning Gemini per tech stack spec

    def generate_forensic_analysis(self, serialized_subgraph: str, question: str) -> Dict[str, Any]:
        """
        Phase 1 interface stub for GraphRAG queries.
        Phase 3 will implement full sub-graph prompt construction and LLM inference.
        """
        if not serialized_subgraph or serialized_subgraph.strip() == "":
            return {
                "summary": "No active node data found in the current dashboard filter.",
                "likely_origin_node_id": None,
                "coordination_flags": [],
                "confidence_note": "Filter return was empty."
            }

        logger.info(f"Submitting GraphRAG query to provider {self.provider}")
        return {
            "summary": "Sub-graph analysis indicates high-density interaction around bot cluster nodes sharing common IP infrastructure.",
            "likely_origin_node_id": "p_seed_001",
            "coordination_flags": [
                {"cluster_ip": "192.168.1.105", "user_ids": ["u_bot_01", "u_bot_02", "u_bot_03"]}
            ],
            "confidence_note": "Phase 1 LLM adapter interface stub ready for Phase 3 integration."
        }

llm_client = LLMAdapter()
