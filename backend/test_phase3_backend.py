import os

# Hermetic: never touch a real database or LLM from unit tests.
os.environ["NEO4J_URI"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["DEV_DEFAULT_ACCOUNT_ENABLED"] = "true"
os.environ["ENVIRONMENT"] = "test"

"""Phase 3 — GraphRAG forensic analyst contract tests (docs/06_GRAPHRAG.md)."""
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.ai.context import MAX_CONTEXT_EDGES, MAX_CONTEXT_NODES, build_context, serialize_context
from app.ai.llm_client import LLMAdapter, LLMAdapterError, LLMResult, _gemini_text, parse_json_response
from app.db.memory import memory_store
from app.routes import ai as ai_route
from app.routes.ai import query_ai
from app.schemas.ai import AIQueryRequest
from app.schemas.filters import GraphFilters

GRAPH = {
    "nodes": [
        {"id": "u1", "label": "User", "props": {"handle": "@one", "flagged": True}},
        {"id": "u2", "label": "User", "props": {"handle": "@two"}},
        {"id": "p1", "label": "Post", "props": {"text": "Share before deleted", "severity": 0.9}},
        {"id": "ip1", "label": "IPAddress", "props": {"address": "192.0.2.1", "network_type": "datacenter"}},
    ],
    "edges": [
        {"source": "u1", "target": "p1", "type": "POSTED"},
        {"source": "u2", "target": "p1", "type": "RETWEETED"},
        {"source": "u1", "target": "ip1", "type": "POSTED_FROM"},
        {"source": "u2", "target": "ip1", "type": "POSTED_FROM"},
    ],
}
ACCOUNT = {"sub": "analyst@example.org", "user_id": "acct-1"}


def model_answer(**overrides):
    answer = {
        "summary": "Two accounts on one datacenter IP amplified p1.",
        "likely_origin_node_id": "p1",
        "origin_rationale": "Earliest post, retweeted by u2.",
        "coordination_flags": [
            {"signal": "Shared IP", "details": "u1 and u2 use ip1", "evidence_node_ids": ["u1", "u2", "ip1"], "strength": "strong"}
        ],
        "evidence_node_ids": ["p1", "u1"],
        "missing_evidence": ["No timing data for u2"],
        "confidence": "medium",
        "confidence_note": "Shared IP is suggestive, not proof.",
    }
    answer.update(overrides)
    return LLMResult(answer, "gemini", "test-model", 42)


def ask(question="Why is this suspicious?", **request_kwargs):
    return query_ai(AIQueryRequest(question=question, **request_kwargs), account=ACCOUNT)


class GraphRAGRouteTests(unittest.TestCase):
    def setUp(self):
        ai_route.rate_limiter = ai_route._RateLimiter()
        self.patches = [
            patch("app.routes.ai.get_graph", return_value=GRAPH),
            patch("app.routes.ai.compute_clusters", return_value=[]),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in self.patches:
            item.stop()

    def test_empty_graph_does_not_call_llm(self):
        with patch("app.routes.ai.get_graph", return_value={"nodes": [], "edges": []}), patch(
            "app.routes.ai.llm_client.generate_forensic_analysis"
        ) as generate:
            response = ask()
        generate.assert_not_called()
        self.assertEqual(response.evidence_node_ids, [])
        self.assertIn("empty graph", response.confidence_note)
        self.assertEqual(response.context.nodes_analyzed, 0)

    def test_valid_answer_is_grounded_and_reports_context(self):
        with patch("app.routes.ai.llm_client.generate_forensic_analysis", return_value=model_answer()):
            response = ask()
        self.assertEqual(response.likely_origin_node_id, "p1")
        self.assertEqual(response.evidence_node_ids[0], "p1")
        self.assertEqual(response.confidence, "medium")
        self.assertEqual(response.coordination_flags[0].strength, "strong")
        self.assertEqual(response.discarded_node_ids, [])
        self.assertEqual(response.context.nodes_analyzed, 4)
        self.assertEqual(response.context.model, "test-model")

    def test_a_few_unknown_ids_are_removed_and_disclosed(self):
        answer = model_answer(evidence_node_ids=["p1", "u1", "u2", "ip1", "ghost"])
        with patch("app.routes.ai.llm_client.generate_forensic_analysis", return_value=answer):
            response = ask()
        self.assertNotIn("ghost", response.evidence_node_ids)
        self.assertEqual(response.discarded_node_ids, ["ghost"])

    def test_invalid_origin_is_removed(self):
        with patch("app.routes.ai.llm_client.generate_forensic_analysis",
                   return_value=model_answer(likely_origin_node_id="not-in-graph")):
            response = ask()
        self.assertIsNone(response.likely_origin_node_id)
        self.assertIn("not-in-graph", response.discarded_node_ids)

    def test_mostly_hallucinated_evidence_is_rejected(self):
        answer = model_answer(
            likely_origin_node_id="x0",
            evidence_node_ids=["x1", "x2", "x3"],
            coordination_flags=[{"signal": "s", "details": "d", "evidence_node_ids": ["x4"]}],
        )
        with patch("app.routes.ai.llm_client.generate_forensic_analysis", return_value=answer):
            with self.assertRaises(HTTPException) as error:
                ask()
        self.assertEqual(error.exception.status_code, 502)

    def test_invalid_schema_is_a_502(self):
        with patch("app.routes.ai.llm_client.generate_forensic_analysis",
                   return_value=LLMResult({"summary": ""}, "gemini", "m", 1)):
            with self.assertRaises(HTTPException) as error:
                ask()
        self.assertEqual(error.exception.status_code, 502)

    def test_provider_failure_is_explicit(self):
        with patch("app.routes.ai.llm_client.generate_forensic_analysis",
                   side_effect=LLMAdapterError("LLM provider timed out.")):
            with self.assertRaises(HTTPException) as error:
                ask()
        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("timed out", error.exception.detail)

    def test_rate_limit_returns_429(self):
        with patch("app.routes.ai.settings.AI_RATE_LIMIT_PER_MINUTE", 2), patch(
            "app.routes.ai.llm_client.generate_forensic_analysis", return_value=model_answer()
        ):
            ask()
            ask()
            with self.assertRaises(HTTPException) as error:
                ask()
        self.assertEqual(error.exception.status_code, 429)

    def test_prompt_contains_history_and_focus(self):
        captured = {}

        def fake(system_prompt, user_prompt):
            captured["prompt"] = user_prompt
            return model_answer()

        with patch("app.routes.ai.llm_client.generate_forensic_analysis", side_effect=fake):
            ask(
                "And who started it?",
                focus_node_ids=["u1"],
                history=[{"question": "Why suspicious?", "summary": "Shared IP."}],
            )
        self.assertIn("ANALYST FOCUS: u1", captured["prompt"])
        self.assertIn("Q: Why suspicious?", captured["prompt"])
        self.assertIn("<evidence>", captured["prompt"])


class RequestValidationTests(unittest.TestCase):
    def test_question_and_unknown_fields_are_validated(self):
        with self.assertRaises(ValidationError):
            AIQueryRequest(question="  a ")
        with self.assertRaises(ValidationError):
            AIQueryRequest(question="valid question", unexpected=True)
        with self.assertRaises(ValidationError):
            AIQueryRequest(question="x" * 2001)


class ContextExtractionTests(unittest.TestCase):
    def setUp(self):
        self.filters = GraphFilters()
        self.graph = memory_store.graph(self.filters)
        self.clusters = memory_store.coordination_clusters(self.filters)

    def test_context_is_bounded_and_connected(self):
        context = build_context(self.graph, self.clusters)
        labels = {node["label"] for node in context.nodes}
        self.assertLessEqual(len(context.nodes), MAX_CONTEXT_NODES)
        self.assertLessEqual(len(context.edges), MAX_CONTEXT_EDGES)
        self.assertEqual(labels, {"User", "Post", "Hashtag", "IPAddress"})
        ids = {node["id"] for node in context.nodes}
        self.assertTrue(all(edge["source"] in ids and edge["target"] in ids for edge in context.edges))

    def test_top_cluster_and_findings_are_included(self):
        context = build_context(self.graph, self.clusters)
        ids = {node["id"] for node in context.nodes}
        top = self.clusters[0]
        self.assertIn(top["ip_id"], ids)
        self.assertTrue(set(top["user_ids"]) & ids)
        kinds = {finding["kind"] for finding in context.findings}
        self.assertIn("coordination_cluster", kinds)
        self.assertIn("near_duplicate_text", kinds)
        text = serialize_context(context)
        self.assertIn("DETECTOR FINDINGS", text)
        self.assertIn("[C1]", text)

    def test_focus_nodes_are_prioritised(self):
        organic_post = next(n["id"] for n in self.graph["nodes"] if n["label"] == "Post" and n["id"].startswith("pst_0"))
        context = build_context(self.graph, self.clusters, [organic_post])
        self.assertEqual(context.nodes[0]["id"], organic_post)
        self.assertEqual(context.focus_node_ids, [organic_post])


class AdapterTests(unittest.TestCase):
    def test_fenced_and_prefixed_json_is_parsed(self):
        self.assertEqual(parse_json_response('```json\n{"summary": "ok"}\n```')["summary"], "ok")
        self.assertEqual(parse_json_response('Here you go: {"summary": "ok"}')["summary"], "ok")

    def test_malformed_json_is_rejected(self):
        with self.assertRaises(LLMAdapterError):
            parse_json_response("not json")

    def test_missing_key_is_reported_without_calling_provider(self):
        adapter = LLMAdapter(provider="gemini", api_key="")
        self.assertFalse(adapter.status()["configured"])
        with self.assertRaises(LLMAdapterError):
            adapter.generate_forensic_analysis("s", "u")

    def test_unknown_provider_is_reported(self):
        self.assertIn("Unknown LLM_PROVIDER", LLMAdapter(provider="nope", api_key="k").status()["detail"])

    def test_gemini_thought_parts_are_skipped_and_truncation_detected(self):
        payload = {"candidates": [{"finishReason": "STOP", "content": {"parts": [
            {"text": "thinking...", "thought": True}, {"text": '{"summary": "ok"}'}]}}]}
        self.assertEqual(_gemini_text(payload), '{"summary": "ok"}')
        with self.assertRaises(LLMAdapterError):
            _gemini_text({"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": []}}]})


if __name__ == "__main__":
    unittest.main()
