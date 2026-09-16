# 06 — GraphRAG (AI Forensic Analyst)

## 1. What "GraphRAG" means here

Standard RAG retrieves *text chunks* similar to a query. GraphRAG here instead retrieves a **sub-graph** (structurally relevant nodes/edges, based on the analyst's active filter) and passes both its structure and its text content to the LLM — so the model can reason about relationships ("who retweeted whom, from which shared IP"), not just isolated post content.

## 2. Flow

1. **Input**: the analyst's current dashboard filter (date range, severity, platform, density threshold) + a natural-language question typed into the chat panel.
2. **Sub-graph extraction**: backend re-runs the filter as a bounded Cypher query (see `04_GRAPH_SCHEMA.md` §3) to fetch the exact nodes/edges currently in view, capped by hop-depth and a `LIMIT` so the result stays small enough to serialize.
3. **Serialization**: convert the sub-graph into a compact text representation the LLM can read, e.g.:
   ```
   NODES:
   User(u1, handle=@foo, ip=ip1, flagged=true)
   Post(p1, text="...", severity=0.8, timestamp=...)
   ...
   EDGES:
   (u1)-[POSTED]->(p1)
   (u2)-[RETWEETED]->(p1)
   (u1)-[POSTED_FROM]->(ip1)
   (u2)-[POSTED_FROM]->(ip1)
   ```
   Keep this format simple and consistent — it's easier for the LLM to parse than raw Cypher result JSON.
4. **Prompt construction**: system prompt frames the LLM as a forensic OSINT analyst; user content = serialized sub-graph + the analyst's question. Ask explicitly for: narrative origin (if identifiable), coordination signals (shared IP + tight timing + shared hashtag), and a plain-language summary.
5. **LLM call**: through the single adapter function (`backend/app/ai/llm_client.py`) so the provider (Gemini or otherwise) is swappable.
6. **Response**: return structured JSON where possible (e.g., `{summary, likely_origin_node_id, coordination_flags: [...], confidence_note}`) so the frontend can render it richly rather than as a wall of text — but degrade gracefully to plain text if structured output isn't reliable with the chosen model.

## 3. Orchestration library

Either LangChain or LlamaIndex can implement steps 2–5 above; both have Neo4j-aware retrievers. Suggested approach: don't over-invest in the framework's "magic" graph-RAG abstractions initially — hand-roll the Cypher query + serialization + prompt (steps 2–4) for full control and transparency (useful for a viva/demo where you need to explain exactly what's happening), and use the framework mainly for LLM call management/streaming if it saves boilerplate.

## 4. Prompt template (starting point)

```
SYSTEM:
You are a forensic OSINT analyst. You are given a sub-graph of accounts, posts,
hashtags and IP addresses extracted from a filtered view of a social network.
Analyze structure (who is connected to whom, shared infrastructure, timing)
together with post content. Be specific about which nodes support your
conclusions. If evidence is weak or absent, say so — do not overstate confidence.

USER:
Sub-graph:
<serialized sub-graph>

Question: <analyst's question>
```

## 5. Handling "no clear answer"

Because the underlying data is simulated and filters may return sparse/empty sub-graphs, the LLM adapter should handle: (a) empty sub-graph → return a canned "no data in this filter" response without calling the LLM (saves cost, avoids hallucination), (b) LLM error/timeout → surface a clear error to the frontend rather than failing silently.

## 6. Provider swap checklist

When the LLM is finalized (currently leaning Gemini):
- [ ] Confirm the SDK/API shape (`google-generativeai` for Gemini vs. `anthropic`/`openai` clients).
- [ ] Update only `llm_client.py`.
- [ ] Re-test structured-output parsing — different models vary in how reliably they return valid JSON when asked.
