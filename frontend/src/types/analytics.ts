export interface Trend {
  previous: number;
  delta_pct: number | null;
}

export interface SummaryTrends {
  total_posts: Trend | null;
  total_flagged_users: Trend | null;
  coordinated_clusters: Trend | null;
  high_severity_posts: Trend | null;
  avg_severity: Trend | null;
}

export interface AnalyticsSummary {
  total_posts: number;
  total_accounts: number;
  total_flagged_users: number;
  coordinated_clusters: number;
  high_severity_posts: number;
  avg_severity: number;
  posts_over_time: Array<{ bucket: string; count: number; high_severity: number }>;
  top_hashtags: Array<{ tag: string; count: number }>;
  platform_breakdown: Array<{ platform: string; count: number }>;
  severity_distribution: Array<{ range: string; count: number }>;
  trends: SummaryTrends | null;
  density_scoped: boolean;
}

export interface RiskFactors {
  size: number;
  tempo: number;
  severity: number;
  infrastructure: number;
  duplication: number;
}

export interface CoordinatedCluster {
  id: string;
  ip_id: string;
  cluster_ip: string;
  network_type: string | null;
  hashtag: string;
  user_ids: string[];
  user_handles: string[];
  flagged_users: number;
  post_ids: string[];
  platforms: string[];
  first_seen: string;
  last_seen: string;
  time_window_minutes: number;
  avg_severity: number;
  risk_factors: RiskFactors;
  risk_score: number;
}

export interface PublicStats {
  storage_mode: 'memory' | 'neo4j' | 'neo4j_unavailable';
  entities: Record<string, number>;
  coordinated_clusters: number;
}

export interface HealthStatus {
  status: 'online' | 'degraded';
  storage_mode: 'memory' | 'neo4j' | 'neo4j_unavailable';
  dev_account_enabled: boolean;
  environment: string;
  ai: { configured: boolean; provider: string; model: string };
  simulator_enabled: boolean;
}

export interface CoordinationDemoResult {
  scenario_id: string;
  shared_ip: string;
  hashtag: string;
  platform: string;
  accounts_created: number;
  posts_created: number;
  window_seconds: number;
  user_ids: string[];
  post_ids: string[];
}
