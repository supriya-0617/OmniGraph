from pydantic import BaseModel, Field


class TimeBucket(BaseModel):
    bucket: str = Field(description="ISO date (UTC day)")
    count: int
    high_severity: int = 0


class TagCount(BaseModel):
    tag: str
    count: int


class PlatformCount(BaseModel):
    platform: str
    count: int


class SeverityBucket(BaseModel):
    range: str
    count: int


class Trend(BaseModel):
    previous: float
    delta_pct: float | None = Field(description="Percent change vs. the previous equal-length window; null when previous is 0")


class SummaryTrends(BaseModel):
    total_posts: Trend | None = None
    total_flagged_users: Trend | None = None
    coordinated_clusters: Trend | None = None
    high_severity_posts: Trend | None = None
    avg_severity: Trend | None = None


class AnalyticsSummary(BaseModel):
    total_posts: int
    total_accounts: int
    total_flagged_users: int
    coordinated_clusters: int
    high_severity_posts: int
    avg_severity: float
    posts_over_time: list[TimeBucket]
    top_hashtags: list[TagCount]
    platform_breakdown: list[PlatformCount]
    severity_distribution: list[SeverityBucket]
    trends: SummaryTrends | None = Field(default=None, description="Present when both from and to are set")
    density_scoped: bool = Field(description="True when min_density > 1 restricted every aggregate to qualifying cluster posts")


class RiskFactors(BaseModel):
    size: float
    tempo: float
    severity: float
    infrastructure: float
    duplication: float


class CoordinatedCluster(BaseModel):
    id: str
    ip_id: str
    cluster_ip: str
    network_type: str | None = None
    hashtag: str
    user_ids: list[str]
    user_handles: list[str]
    flagged_users: int
    post_ids: list[str]
    platforms: list[str]
    first_seen: str
    last_seen: str
    time_window_minutes: float
    avg_severity: float
    risk_factors: RiskFactors
    risk_score: float


class PublicStats(BaseModel):
    storage_mode: str
    entities: dict[str, int]
    coordinated_clusters: int
