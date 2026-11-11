import os

# Hermetic: never touch a real database or LLM from unit tests.
os.environ["NEO4J_URI"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["DEV_DEFAULT_ACCOUNT_ENABLED"] = "true"
os.environ["ENVIRONMENT"] = "test"

import unittest
from unittest.mock import patch

from app.routes.auth import LoginRequest, login


class DevelopmentAccountTests(unittest.TestCase):
    def test_default_account_logs_in_only_in_memory_mode(self):
        with patch("app.routes.auth.db.is_memory_mode", return_value=True):
            response = login(LoginRequest(email="1234", password="1234"))
        self.assertEqual(response.user_email, "1234")
        self.assertTrue(response.access_token)

    def test_default_account_is_rejected_when_disabled(self):
        with patch("app.routes.auth.db.is_memory_mode", return_value=True), patch(
            "app.routes.auth.settings.DEV_DEFAULT_ACCOUNT_ENABLED", False
        ):
            with self.assertRaises(Exception):
                login(LoginRequest(email="1234", password="1234"))

    def test_default_account_is_not_available_with_configured_database(self):
        with patch("app.routes.auth.db.is_memory_mode", return_value=False), patch(
            "app.routes.auth.db.is_connected", return_value=False
        ):
            with self.assertRaises(Exception):
                login(LoginRequest(email="1234", password="1234"))
