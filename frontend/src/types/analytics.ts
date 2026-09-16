export interface AnalyticsSummary {
  total_posts: number;
  total_flagged_users: number;
  coordinated_clusters: number;
  avg_severity: number;
  posts_over_time: Array<{ bucket: string; count: number }>;
  top_hashtags: Array<{ tag: string; count: number }>;
}

export interface CoordinatedCluster {
  id: string;
  cluster_ip: string;
  user_handles: string[];
  hashtag: string;
  time_window_minutes: number;
  risk_score: number;
}
