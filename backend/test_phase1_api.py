import sys
import os
import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000"

def post_json(path, data):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get_json(path):
    req = urllib.request.Request(f"{BASE_URL}{path}", method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def test_flow():
    print("--- 1. Testing Health Endpoint ---")
    status_code, body = get_json("/health")
    print(f"Health Status: {status_code}, Body: {body}")
    assert status_code == 200, "Health check failed"

    print("\n--- 2. Testing Register ---")
    test_email = "analyst_test@omnigraph.org"
    test_password = "SecurePassword123!"
    status_code, body = post_json("/auth/register", {"email": test_email, "password": test_password})
    print(f"Register Status: {status_code}, Body: {body}")
    assert status_code == 201, "Register failed"
    assert body["email"] == test_email

    print("\n--- 3. Testing Duplicate Register Error ---")
    status_code, body = post_json("/auth/register", {"email": test_email, "password": test_password})
    print(f"Duplicate Register Status: {status_code}, Body: {body}")
    assert status_code == 400, "Duplicate register should fail with 400"

    print("\n--- 4. Testing Login Success ---")
    status_code, body = post_json("/auth/login", {"email": test_email, "password": test_password})
    print(f"Login Status: {status_code}, Body: {body}")
    assert status_code == 200, "Login failed"
    assert "access_token" in body
    assert body["user_email"] == test_email

    print("\n--- 5. Testing Login Invalid Password ---")
    status_code, body = post_json("/auth/login", {"email": test_email, "password": "WrongPassword"})
    print(f"Invalid Login Status: {status_code}, Body: {body}")
    assert status_code == 401, "Invalid login should fail with 401"

    print("\n==============================================")
    print("SUCCESS: ALL PHASE 1 BACKEND API TESTS PASSED!")
    print("==============================================")

if __name__ == "__main__":
    test_flow()
