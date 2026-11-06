import os

# Hermetic: never touch a real database or LLM from unit tests.
os.environ["NEO4J_URI"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["DEV_DEFAULT_ACCOUNT_ENABLED"] = "true"
os.environ["ENVIRONMENT"] = "test"

"""Analytics correctness tests against the deterministic dataset (docs/07_ANALYTICS.md)."""
import unittest
from datetime import date, timedelta

from app.analytics import risk_factors, risk_score
from app.db.memory import memory_store
from app.schemas.analytics import AnalyticsSummary, CoordinatedCluster
from app.schemas.filters import GraphFilters

TODAY = date.today()


class SummaryFilterTests(unittest.TestCase):
    def test_summary_matches_response_schema(self):
        AnalyticsSummary.model_validate(memory_store.summary(GraphFilters()))

    def test_date_filter_reduces_population_and_buckets_stay_in_range(self):
        start = TODAY - timedelta(days=2)
        summary = memory_store.summary(GraphFilters(from_date=start, to_date=TODAY))
        full = memory_store.summary(GraphFilters())
        self.assertLess(summary["total_posts"], full["total_posts"])
        self.assertTrue(all(start.isoformat() <= row["bucket"] <= TODAY.isoformat() for row in summary["posts_over_time"]))
        self.assertEqual(sum(row["count"] for row in summary["posts_over_time"]), summary["total_posts"])

    def test_severity_filter(self):
        summary = memory_store.summary(GraphFilters(min_severity=0.8))
        self.assertGreater(summary["total_posts"], 0)
        self.assertGreaterEqual(summary["avg_severity"], 0.8)
        self.assertEqual(summary["severity_distribution"][-1]["count"], summary["total_posts"])

    def test_platform_filter(self):
        summary = memory_store.summary(GraphFilters(platform="Telegram"))
        self.assertEqual([row["platform"] for row in summary["platform_breakdown"]], ["Telegram"])

    def test_density_filter_scopes_every_aggregate_to_cluster_posts(self):
        filters = GraphFilters(min_density=5)
        summary = memory_store.summary(filters)
        cluster_posts = {pid for cluster in memory_store.coordination_clusters(filters) for pid in cluster["post_ids"]}
        self.assertTrue(summary["density_scoped"])
        self.assertEqual(summary["total_posts"], len(cluster_posts))
        self.assertGreater(summary["avg_severity"], 0.7)

    def test_empty_results(self):
        future = TODAY + timedelta(days=30)
        summary = memory_store.summary(GraphFilters(from_date=future, to_date=future))
        self.assertEqual(summary["total_posts"], 0)
        self.assertEqual(summary["avg_severity"], 0)
        self.assertEqual(summary["posts_over_time"], [])
        self.assertEqual(memory_store.coordination_clusters(GraphFilters(from_date=future, to_date=future)), [])

    def test_trends_use_previous_equal_window(self):
        summary = memory_store.summary(GraphFilters(from_date=TODAY - timedelta(days=6), to_date=TODAY))
        self.assertIsNotNone(summary["trends"])
        self.assertIn("previous", summary["trends"]["total_posts"])
        self.assertIsNone(memory_store.summary(GraphFilters())["trends"])


class ClusterTests(unittest.TestCase):
    def test_clusters_are_ranked_and_valid(self):
        clusters = memory_store.coordination_clusters(GraphFilters(min_density=2))
        scores = [cluster["risk_score"] for cluster in clusters]
        self.assertEqual(scores, sorted(scores, reverse=True))
        for cluster in clusters:
            CoordinatedCluster.model_validate(cluster)
            self.assertGreaterEqual(len(cluster["user_ids"]), 2)

    def test_six_campaigns_detected_and_benign_nat_ranks_last(self):
        clusters = memory_store.coordination_clusters(GraphFilters(min_density=2))
        campaign_ips = {cluster["ip_id"] for cluster in clusters if cluster["ip_id"].startswith("net_c")}
        self.assertEqual(len(campaign_ips), 6)
        benign = next(cluster for cluster in clusters if cluster["ip_id"] == "net_nat_campus")
        self.assertEqual(clusters[-1]["id"], benign["id"])
        self.assertLess(benign["risk_score"], 0.4)

    def test_risk_score_formula(self):
        factors = risk_factors(user_count=8, window_minutes=0, avg_severity=1.0, network_type="datacenter", duplication=1.0)
        self.assertEqual(risk_score(factors), 1.0)
        low = risk_factors(user_count=2, window_minutes=60, avg_severity=0.1, network_type="university", duplication=0)
        self.assertLess(risk_score(low), 0.15)


if __name__ == "__main__":
    unittest.main()
