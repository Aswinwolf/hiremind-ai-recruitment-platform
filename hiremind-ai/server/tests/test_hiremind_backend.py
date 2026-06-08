"""HireMind AI backend & parser smoke + integration test suite.

Targets:
  - Node API:     http://localhost:5000 (all routes prefixed /api)
  - Python Parser: http://localhost:5001

These are LOCAL services for the standalone /app/hiremind-ai/ scaffold,
NOT the Kubernetes-ingress-routed main /app project.
"""
import os
import time
import uuid
import pytest
import requests

API = "http://localhost:5000"
PARSER = "http://localhost:5001"
SAMPLE_PDF = "/tmp/test_resume.pdf"
SEEDED_EMAIL = "test@hiremind.local"
SEEDED_PASSWORD = "StrongP@ss123!"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def login_data(s):
    """Login as the seeded candidate user. Skips entire session if it fails."""
    r = s.post(f"{API}/api/auth/login",
               json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Login with seeded test creds failed: {r.status_code} {r.text}")
    data = r.json()
    assert "token" in data
    return {"token": data["token"], "user": data["user"], "cookies": r.cookies.get_dict()}


@pytest.fixture(scope="session")
def auth_headers(login_data):
    return {"Authorization": f"Bearer {login_data['token']}",
            "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class TestHealth:
    def test_server_health(self, s):
        r = s.get(f"{API}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("service") == "hiremind-server"
        assert "uptime" in data

    def test_uptime_increases(self, s):
        r1 = s.get(f"{API}/api/health").json()
        time.sleep(1.1)
        r2 = s.get(f"{API}/api/health").json()
        assert r2["uptime"] > r1["uptime"]

    def test_parser_health(self, s):
        r = s.get(f"{PARSER}/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("service") == "parser"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TestAuth:
    def test_register_weak_password(self, s):
        r = s.post(f"{API}/api/auth/register", json={
            "name": "Weak", "email": f"weak_{uuid.uuid4().hex[:6]}@x.com",
            "password": "short"
        })
        assert r.status_code == 400
        assert "Password" in r.json().get("message", "") or "password" in r.json().get("message", "").lower()

    def test_register_missing_fields(self, s):
        r = s.post(f"{API}/api/auth/register", json={"email": "x@x.com"})
        assert r.status_code == 400

    def test_register_then_duplicate(self, s):
        email = f"newuser_{uuid.uuid4().hex[:8]}@hiremind.local"
        payload = {"name": "New User", "email": email, "password": "StrongP@ss123!"}
        r1 = s.post(f"{API}/api/auth/register", json=payload)
        assert r1.status_code == 201, r1.text
        body = r1.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 0
        assert body["user"]["email"] == email
        # httpOnly refresh cookie should be set
        assert "rt" in r1.cookies.get_dict(), "Refresh cookie 'rt' not set on register"

        # Duplicate
        r2 = s.post(f"{API}/api/auth/register", json=payload)
        assert r2.status_code == 400
        assert "already" in r2.json().get("message", "").lower()

    def test_login_success(self, s):
        r = s.post(f"{API}/api/auth/login",
                   json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == SEEDED_EMAIL
        assert "rt" in r.cookies.get_dict(), "Refresh cookie not set on login"

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/api/auth/login",
                   json={"email": SEEDED_EMAIL, "password": "WrongP@ssword123!"})
        assert r.status_code == 400
        assert "Invalid credentials" in r.json().get("message", "")

    def test_login_unknown_email(self, s):
        r = s.post(f"{API}/api/auth/login",
                   json={"email": "doesnotexist@hiremind.local", "password": "StrongP@ss123!"})
        assert r.status_code == 404

    def test_refresh_rotates_token(self):
        sess = requests.Session()
        r = sess.post(f"{API}/api/auth/login",
                      json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD})
        assert r.status_code == 200
        old_rt = sess.cookies.get("rt")
        assert old_rt

        r2 = sess.post(f"{API}/api/auth/refresh")
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "token" in data and len(data["token"]) > 0
        new_rt = sess.cookies.get("rt")
        assert new_rt and new_rt != old_rt, "Refresh token should rotate"

        # Old refresh should now be revoked. Reusing it must fail.
        bad = requests.Session()
        bad.cookies.set("rt", old_rt)
        r3 = bad.post(f"{API}/api/auth/refresh")
        assert r3.status_code == 401, f"Old refresh should be revoked, got {r3.status_code}"

    def test_logout_clears_cookie(self):
        sess = requests.Session()
        r = sess.post(f"{API}/api/auth/login",
                      json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD})
        assert r.status_code == 200
        rt = sess.cookies.get("rt")
        assert rt
        r2 = sess.post(f"{API}/api/auth/logout")
        assert r2.status_code == 200
        # After logout, the refresh token should be revoked
        bad = requests.Session()
        bad.cookies.set("rt", rt)
        r3 = bad.post(f"{API}/api/auth/refresh")
        assert r3.status_code == 401


# ---------------------------------------------------------------------------
# Auth gates
# ---------------------------------------------------------------------------
class TestAuthGates:
    @pytest.mark.parametrize("path,method", [
        ("/api/candidate/me", "GET"),
        ("/api/candidate/select-role", "POST"),
        ("/api/candidate/calculate-ats", "POST"),
        ("/api/roles", "GET"),
        ("/api/interview/start", "POST"),
        ("/api/hr/candidates", "GET"),
        ("/api/admin/users", "GET"),
    ])
    def test_requires_token(self, s, path, method):
        r = s.request(method, f"{API}{path}", json={})
        # Should be 401 unauthorized when token missing
        assert r.status_code == 401, f"{path} returned {r.status_code} without auth (expected 401)"


# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------
class TestRoles:
    def test_seed_idempotent(self, s):
        r1 = s.post(f"{API}/api/roles/seed")
        assert r1.status_code == 200
        assert r1.json().get("count") == 5
        r2 = s.post(f"{API}/api/roles/seed")
        assert r2.status_code == 200

    def test_list_roles_sorted(self, s, auth_headers):
        r = s.get(f"{API}/api/roles", headers=auth_headers)
        assert r.status_code == 200, r.text
        roles = r.json()
        assert isinstance(roles, list)
        assert len(roles) == 5
        titles = [x["title"] for x in roles]
        assert titles == sorted(titles), "Roles must be sorted alphabetically by title"

    def test_role_rbac_candidate_forbidden(self, s, auth_headers):
        # Get a role id first
        roles = s.get(f"{API}/api/roles", headers=auth_headers).json()
        rid = roles[0]["_id"]
        r = s.put(f"{API}/api/roles/{rid}",
                  json={"title": roles[0]["title"]}, headers=auth_headers)
        assert r.status_code == 403, f"Candidate must not edit roles (got {r.status_code})"


# ---------------------------------------------------------------------------
# Parser direct
# ---------------------------------------------------------------------------
class TestParser:
    def test_parse_missing_field(self, s):
        r = s.post(f"{PARSER}/parse", json={})
        assert r.status_code == 400

    def test_parse_file_not_found(self, s):
        r = s.post(f"{PARSER}/parse", json={"filePath": "/tmp/nope_does_not_exist.pdf"})
        assert r.status_code == 400

    def test_parse_sample_pdf(self, s):
        assert os.path.exists(SAMPLE_PDF), f"sample resume missing: {SAMPLE_PDF}"
        r = s.post(f"{PARSER}/parse", json={"filePath": SAMPLE_PDF}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "skills" in data and isinstance(data["skills"], list)
        skill_lower = [str(x).lower() for x in data["skills"]]
        # At least one of these expected tokens should appear
        expected_any = ["python", "react", "node.js", "node"]
        assert any(k in skill_lower for k in expected_any), \
            f"Expected at least one of {expected_any} in skills: {data['skills']}"


# ---------------------------------------------------------------------------
# Candidate flow (select role -> upload resume -> calculate ATS)
# ---------------------------------------------------------------------------
class TestCandidateFlow:
    def test_select_role(self, s, auth_headers):
        r = s.post(f"{API}/api/candidate/select-role",
                   json={"selectedRole": "MERN Developer"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["candidate"]["selectedRole"] == "MERN Developer"

    def test_select_role_missing_body(self, s, auth_headers):
        r = s.post(f"{API}/api/candidate/select-role", json={}, headers=auth_headers)
        assert r.status_code == 400

    def test_select_role_unknown(self, s, auth_headers):
        r = s.post(f"{API}/api/candidate/select-role",
                   json={"selectedRole": "Nonexistent Role XYZ"}, headers=auth_headers)
        assert r.status_code == 404

    def test_candidate_me(self, s, auth_headers):
        r = s.get(f"{API}/api/candidate/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body is not None
        assert body.get("selectedRole") == "MERN Developer"

    def test_upload_resume(self, login_data):
        assert os.path.exists(SAMPLE_PDF)
        headers = {"Authorization": f"Bearer {login_data['token']}"}
        with open(SAMPLE_PDF, "rb") as f:
            files = {"resume": ("test_resume.pdf", f, "application/pdf")}
            r = requests.post(f"{API}/api/candidate/upload-resume",
                              headers=headers, files=files, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "parsedResume" in body
        assert isinstance(body["parsedResume"].get("skills"), list)

    def test_calculate_ats(self, s, auth_headers):
        r = s.post(f"{API}/api/candidate/calculate-ats", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "atsScore" in data and 0 <= data["atsScore"] <= 100
        assert "missingSkills" in data and isinstance(data["missingSkills"], list)
        assert "isEligible" in data and isinstance(data["isEligible"], bool)
        assert "threshold" in data


# ---------------------------------------------------------------------------
# Rate limit sanity
# ---------------------------------------------------------------------------
class TestRateLimitSanity:
    def test_health_5_sequential(self, s):
        codes = []
        for _ in range(5):
            codes.append(s.get(f"{API}/api/health").status_code)
        assert all(c == 200 for c in codes), f"Unexpected codes: {codes}"
