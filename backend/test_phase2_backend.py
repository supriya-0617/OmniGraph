import unittest
from datetime import date, datetime, timezone
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.analytics import find_coordination_clusters
from app.auth.dependencies import get_current_account
from app.auth.jwt import create_access_token
from app.db.memory import MemoryGraphStore
from app.main import app
from app.routes.graph import get_graph
from app.routes.entities import (
    create_post,
    create_user,
    delete_post,
    delete_user,
    list_posts,
    list_users,
    update_user,
)
from app.routes.filters import get_graph_filters
from app.schemas.filters import GraphFilters
from app.schemas.entities import PostCreate, UserCreate, UserUpdate


class AuthenticationTests(unittest.TestCase):
    def test_bearer_guard_accepts_valid_token_and_rejects_missing_or_invalid(self):
        token = create_access_token({"sub": "analyst@example.org", "user_id": "account-1"})
        claims = get_current_account(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        )
        self.assertEqual(claims["user_id"], "account-1")

        for credentials in (
            None,
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token"),
        ):
            with self.subTest(credentials=credentials), self.assertRaises(HTTPException) as error:
                get_current_account(credentials)
            self.assertEqual(error.exception.status_code, 401)


class FilterTests(unittest.TestCase):
    def test_dashboard_filters_are_normalized_and_end_date_is_inclusive(self):
        filters = get_graph_filters(
            from_=date(2026, 10, 1),
            to=date(2026, 10, 7),
            platform="ALL",
            min_severity=0.4,
            min_density=3,
        )
        params = filters.cypher_params()
        self.assertIsNone(filters.platform)
        self.assertEqual(params["from_date"].hour, 0)
        self.assertEqual(params["to_date"].hour, 23)
        self.assertEqual(params["to_date"].day, 7)
        self.assertEqual(filters.min_density, 3)

    def test_reversed_date_ranges_are_rejected(self):
        with self.assertRaises(ValidationError):
            GraphFilters(from_date=date(2026, 10, 8), to_date=date(2026, 10, 7))


class CoordinationTests(unittest.TestCase):
    def test_shared_ip_hashtag_posts_are_aggregated_into_a_cluster(self):
        start = datetime(2026, 10, 7, tzinfo=timezone.utc)
        records = [
            self._record("u1", "@one", "u2", "@two", "p1", start, "p2", start.replace(minute=5)),
            self._record("u1", "@one", "u3", "@three", "p1", start, "p3", start.replace(minute=10)),
            self._record("u2", "@two", "u3", "@three", "p2", start.replace(minute=5), "p3", start.replace(minute=10)),
        ]
        session = Mock()
        session.run.return_value = records

        clusters = find_coordination_clusters(session, GraphFilters(min_density=3))

        self.assertEqual(len(clusters), 1)
        cluster = clusters[0]
        self.assertEqual(cluster["user_ids"], ["u1", "u2", "u3"])
        self.assertEqual(cluster["post_ids"], ["p1", "p2", "p3"])
        self.assertEqual(cluster["time_window_minutes"], 10)
        self.assertEqual(cluster["risk_score"], 0.775)

    @staticmethod
    def _record(u1_id, u1_handle, u2_id, u2_handle, p1_id, p1_time, p2_id, p2_time):
        return {
            "ip_id": "ip-1",
            "cluster_ip": "192.0.2.10",
            "hashtag": "#example",
            "u1_id": u1_id,
            "u1_handle": u1_handle,
            "u2_id": u2_id,
            "u2_handle": u2_handle,
            "p1_id": p1_id,
            "p1_timestamp": p1_time,
            "p1_severity": 0.9,
            "p2_id": p2_id,
            "p2_timestamp": p2_time,
            "p2_severity": 0.9,
        }


class MemorySeedTests(unittest.TestCase):
    def test_memory_fixture_is_full_sized_and_contains_seeded_clusters(self):
        store = MemoryGraphStore()
        clusters = store.coordination_clusters(GraphFilters(min_density=3))

        self.assertEqual(len(store._nodes["User"]), 200)
        self.assertEqual(len(store._nodes["Post"]), 2000)
        self.assertGreaterEqual(len(clusters), 5)
        self.assertTrue(all(len(cluster["user_ids"]) >= 3 for cluster in clusters))
        graph = store.graph(GraphFilters())
        rendered_posts = sum(node["label"] == "Post" for node in graph["nodes"])
        self.assertEqual(rendered_posts, 120)


class RouteContractTests(unittest.TestCase):
    def test_graph_serializes_all_schema_relationship_types(self):
        session = Mock()
        session.run.side_effect = [
            [
                {
                    "post": {"id": "p1", "text": "post"},
                    "user": {"id": "u1", "handle": "@one"},
                    "author_type": "POSTED",
                    "author_edge": {},
                    "hashtag": {"id": "h1", "tag": "#topic"},
                    "mention_edge": {},
                    "ip": {"id": "ip1", "address": "192.0.2.1"},
                    "ip_edge": {},
                }
            ],
            [
                {
                    "source_label": "Post",
                    "source": {"id": "p1"},
                    "target_label": "Post",
                    "target": {"id": "p2"},
                    "relation": "REPLIED_TO",
                    "relation_props": {},
                },
                {
                    "source_label": "Post",
                    "source": {"id": "p1"},
                    "target_label": "User",
                    "target": {"id": "u2"},
                    "relation": "TAGGED_USER",
                    "relation_props": {},
                },
            ],
            [
                {
                    "source": {"id": "u1"},
                    "target": {"id": "u2"},
                    "target_label": "User",
                    "relation": "FOLLOWS",
                    "relation_props": {},
                }
            ],
        ]
        session_context = Mock()
        session_context.__enter__ = Mock(return_value=session)
        session_context.__exit__ = Mock(return_value=False)

        with patch("app.routes.graph.db.is_connected", return_value=True), patch(
            "app.routes.graph.db.session", return_value=session_context
        ):
            graph = get_graph(GraphFilters())

        relations = {edge["type"] for edge in graph["edges"]}
        self.assertTrue({"POSTED", "MENTIONS", "POSTED_FROM", "REPLIED_TO", "TAGGED_USER", "FOLLOWS"}.issubset(relations))

    def test_post_date_filter_includes_the_entire_to_date(self):
        session = Mock()
        count_result = Mock()
        count_result.single.return_value = {"total": 0}
        session.run.side_effect = [count_result, []]
        session_context = Mock()
        session_context.__enter__ = Mock(return_value=session)
        session_context.__exit__ = Mock(return_value=False)

        with patch("app.routes.entities.db.is_connected", return_value=True), patch(
            "app.routes.entities.db.session", return_value=session_context
        ):
            list_posts(
                from_=date(2026, 10, 1),
                to=date(2026, 10, 7),
                platform="ALL",
                min_severity=None,
            )

        query_params = session.run.call_args_list[1].kwargs
        self.assertEqual(query_params["to"].date(), date(2026, 10, 7))
        self.assertEqual(query_params["to"].hour, 23)

    def test_documented_routes_are_secured_and_expose_filter_names(self):
        schema = app.openapi()
        for path in (
            "/entities/users",
            "/entities/posts",
            "/graph",
            "/analytics/summary",
            "/analytics/clusters",
        ):
            with self.subTest(path=path):
                operation = schema["paths"][path]["get"]
                self.assertTrue(operation.get("security"))

        graph_params = {
            item["name"] for item in schema["paths"]["/graph"]["get"]["parameters"]
        }
        self.assertTrue({"from", "to", "platform", "min_severity", "min_density"}.issubset(graph_params))

    def test_graph_and_analytics_work_without_neo4j(self):
        from app.routes.analytics import get_clusters, get_summary
        from app.routes.graph import get_graph

        with patch("app.routes.graph.db.is_connected", return_value=False):
            graph = get_graph(GraphFilters(min_density=3))
        with patch("app.routes.analytics.db.is_connected", return_value=False):
            summary = get_summary(GraphFilters())
            clusters = get_clusters(GraphFilters())
        with patch("app.routes.entities.db.is_connected", return_value=False):
            users = list_users(offset=0, limit=100)

        self.assertTrue(graph["nodes"])
        self.assertGreater(summary["total_posts"], 0)
        self.assertGreater(summary["coordinated_clusters"], 0)
        self.assertEqual(len(clusters), summary["coordinated_clusters"])
        self.assertGreater(users["total"], 0)

    def test_entity_crud_works_in_memory_without_neo4j(self):
        user_id = "memory-crud-user"
        post_id = "memory-crud-post"
        with patch("app.routes.entities.db.is_connected", return_value=False):
            create_user(UserCreate(id=user_id, handle="@memory_test", platform="X"))
            updated = update_user(user_id, UserUpdate(flagged=True))
            post = create_post(
                PostCreate(
                    id=post_id,
                    text="In-memory post",
                    platform="X",
                    severity=0.5,
                    author_id=user_id,
                    hashtags=["#MemoryTest"],
                )
            )
            deleted_post = delete_post(post_id)
            deleted_user = delete_user(user_id)

        self.assertTrue(updated["flagged"])
        self.assertEqual(post["id"], post_id)
        self.assertTrue(deleted_post["deleted"])
        self.assertTrue(deleted_user["deleted"])


if __name__ == "__main__":
    unittest.main()