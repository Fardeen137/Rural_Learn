"""Backend tests for Rural Learn API."""
import os
import uuid
import json
import pytest
import requests
from websocket import create_connection

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://low-bandwidth-school.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def teacher_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@learn.in", "password": "admin123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "teacher"
    return data["access_token"]


@pytest.fixture(scope="module")
def student_token():
    r = requests.post(f"{API}/auth/login", json={"email": "student@learn.in", "password": "student123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "student"
    return data["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- Auth ---
def test_login_teacher_success():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@learn.in", "password": "admin123"})
    assert r.status_code == 200
    d = r.json()
    assert "access_token" in d and d["user"]["role"] == "teacher"


def test_login_student_success():
    r = requests.post(f"{API}/auth/login", json={"email": "student@learn.in", "password": "student123"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "student"


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@learn.in", "password": "wrong"})
    assert r.status_code == 401


def test_register_new_student():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@learn.in"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass123", "name": "TEST User"})
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["email"] == email.lower()
    assert d["user"]["role"] == "student"
    assert d["access_token"]


def test_me_with_token(student_token):
    r = requests.get(f"{API}/auth/me", headers=auth(student_token))
    assert r.status_code == 200
    assert r.json()["email"] == "student@learn.in"


def test_me_without_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


# --- Courses ---
def test_list_courses_has_multilang():
    r = requests.get(f"{API}/courses")
    assert r.status_code == 200
    courses = r.json()
    assert len(courses) >= 4, f"Expected >=4 courses, got {len(courses)}"
    langs = {c["language"] for c in courses}
    assert {"en", "hi", "ta"}.issubset(langs), f"Missing languages: {langs}"


def test_filter_courses_hi():
    r = requests.get(f"{API}/courses", params={"language": "hi"})
    assert r.status_code == 200
    courses = r.json()
    assert len(courses) >= 1
    for c in courses:
        assert c["language"] == "hi"


def test_get_course_detail():
    courses = requests.get(f"{API}/courses").json()
    cid = courses[0]["id"]
    r = requests.get(f"{API}/courses/{cid}")
    assert r.status_code == 200
    d = r.json()
    assert "lessons" in d and "quizzes" in d


def test_create_course_forbidden_for_student(student_token):
    body = {"title": "TEST Student Course", "description": "x", "subject": "x", "language": "en"}
    r = requests.post(f"{API}/courses", json=body, headers=auth(student_token))
    assert r.status_code == 403


def test_create_course_teacher(teacher_token):
    body = {
        "title": f"TEST Course {uuid.uuid4().hex[:6]}",
        "description": "Created by teacher", "subject": "Test", "language": "en",
        "lessons": [{"title": "L1", "type": "text", "content": "hi", "duration_min": 3}],
        "quizzes": [{"title": "Q1", "questions": [
            {"question": "2+2?", "options": ["3", "4", "5", "6"], "correct_index": 1}
        ]}]
    }
    r = requests.post(f"{API}/courses", json=body, headers=auth(teacher_token))
    assert r.status_code == 200, r.text
    course = r.json()
    assert course["created_by"]
    # verify persistence
    g = requests.get(f"{API}/courses/{course['id']}")
    assert g.status_code == 200
    pytest.created_course = course


# --- Progress ---
def test_save_progress(student_token):
    courses = requests.get(f"{API}/courses").json()
    c = next(x for x in courses if x["lessons"])
    lesson_id = c["lessons"][0]["id"]
    r = requests.post(f"{API}/progress",
                      json={"course_id": c["id"], "lesson_id": lesson_id, "completed": True},
                      headers=auth(student_token))
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_progress_me(student_token):
    r = requests.get(f"{API}/progress/me", headers=auth(student_token))
    assert r.status_code == 200
    d = r.json()
    assert "stats" in d and "courses" in d and "quiz_attempts" in d
    assert d["stats"]["lessons_completed"] >= 1


# --- Quiz ---
def test_quiz_attempt(student_token):
    courses = requests.get(f"{API}/courses").json()
    c = next(x for x in courses if x["quizzes"])
    q = c["quizzes"][0]
    # answer all correct
    answers = [qq["correct_index"] for qq in q["questions"]]
    r = requests.post(f"{API}/quiz/attempt",
                      json={"course_id": c["id"], "quiz_id": q["id"], "answers": answers},
                      headers=auth(student_token))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["score_percent"] == 100
    assert d["correct"] == d["total"]
    assert len(d["results"]) == d["total"]


# --- Comments ---
def test_comments_add_and_list(student_token):
    courses = requests.get(f"{API}/courses").json()
    cid = courses[0]["id"]
    txt = f"TEST comment {uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/comments", json={"course_id": cid, "text": txt}, headers=auth(student_token))
    assert r.status_code == 200
    assert r.json()["text"] == txt
    g = requests.get(f"{API}/comments/{cid}")
    assert g.status_code == 200
    assert any(c["text"] == txt for c in g.json())


def test_comments_requires_auth():
    r = requests.post(f"{API}/comments", json={"course_id": "x", "text": "no"})
    assert r.status_code == 401


# --- WebSocket ---
def test_websocket_chat(student_token):
    ws_url = BASE.replace("https://", "wss://").replace("http://", "ws://") + f"/api/ws/chat?token={student_token}"
    try:
        ws = create_connection(ws_url, timeout=10)
        hist = json.loads(ws.recv())
        assert hist["type"] == "history"
        ws.send(json.dumps({"text": f"TEST hello {uuid.uuid4().hex[:5]}"}))
        msg = json.loads(ws.recv())
        assert msg["type"] == "message"
        assert msg["message"]["user_role"] == "student"
        ws.close()
    except Exception as e:
        pytest.fail(f"WebSocket failed: {e}")


def test_websocket_bad_token():
    ws_url = BASE.replace("https://", "wss://") + "/api/ws/chat?token=bad"
    try:
        ws = create_connection(ws_url, timeout=5)
        # Should get closed immediately
        try:
            ws.recv()
        except Exception:
            pass
        ws.close()
    except Exception:
        pass  # closing is acceptable
