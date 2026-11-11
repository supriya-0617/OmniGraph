export type SignalStrength = 'strong' | 'moderate' | 'weak';
export type Confidence = 'low' | 'medium' | 'high';

export interface CoordinationFlag {
  signal: string;
  details: string;
  evidence_node_ids: string[];
  strength: SignalStrength;
}

export interface AnalysisContext {
  nodes_in_filter: number;
  nodes_analyzed: number;
  edges_analyzed: number;
  clusters_considered: number;
  detector_findings: number;
  truncated: boolean;
  focus_node_ids: string[];
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
}

export interface AIQueryResponse {
  summary: string;
  likely_origin_node_id: string | null;
  origin_rationale: string | null;
  coordination_flags: CoordinationFlag[];
  evidence_node_ids: string[];
  missing_evidence: string[];
  confidence: Confidence;
  confidence_note: string;
  discarded_node_ids: string[];
  context: AnalysisContext | null;
}

export interface AIStatus {
  configured: boolean;
  provider: string;
  model: string;
  detail: string | null;
}

export interface ConversationTurn {
  question: string;
  summary: string;
}
