export type NodeType = 'User' | 'Post' | 'Hashtag' | 'IPAddress';

export interface GraphNodeProps {
  handle?: string;
  follower_count?: number;
  flagged?: boolean;
  text?: string;
  severity?: number;
  timestamp?: string;
  platform?: string;
  tag?: string;
  address?: string;
  geo_region?: string;
  [key: string]: any;
}

export interface GraphNode {
  id: string;
  label: NodeType;
  props: GraphNodeProps;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  timestamp?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  platform: string;
  minSeverity: number;
  minDensity: number;
}
