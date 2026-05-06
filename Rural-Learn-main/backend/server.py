from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Rural Learn API")
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24 * 7  # 7 days for mobile convenience

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


# ---------- Helpers ----------
def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Teacher role required")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: str = Field(default="student")  # "student" or "teacher"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str


class AuthOut(BaseModel):
    access_token: str
    user: UserOut


class LessonIn(BaseModel):
    title: str
    type: str  # "video" | "pdf" | "text"
    youtube_id: Optional[str] = None
    pdf_url: Optional[str] = None
    content: Optional[str] = None
    duration_min: int = 5


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int


class QuizIn(BaseModel):
    title: str
    questions: List[QuizQuestion]


class CourseIn(BaseModel):
    title: str
    description: str
    subject: str
    language: str = "en"  # "en" | "hi" | "ta"
    thumbnail: Optional[str] = None
    lessons: List[LessonIn] = []
    quizzes: List[QuizIn] = []


class CourseOut(BaseModel):
    id: str
    title: str
    description: str
    subject: str
    language: str
    thumbnail: Optional[str]
    lessons: List[dict]
    quizzes: List[dict]
    created_by: str
    created_at: str


class ProgressIn(BaseModel):
    course_id: str
    lesson_id: str
    completed: bool = True


class QuizAttemptIn(BaseModel):
    course_id: str
    quiz_id: str
    answers: List[int]


class CommentIn(BaseModel):
    course_id: str
    text: str


# ---------- Auth Routes ----------
@api_router.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    role = body.role if body.role in ("student", "teacher") else "student"
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "role": role,
        "password_hash": hash_password(body.password),
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, role)
    user_out = {k: doc[k] for k in ("id", "email", "name", "role", "created_at")}
    return {"access_token": token, "user": user_out}


@api_router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"], user["role"])
    user_out = {k: user[k] for k in ("id", "email", "name", "role", "created_at")}
    return {"access_token": token, "user": user_out}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Course Routes ----------
@api_router.get("/courses", response_model=List[CourseOut])
async def list_courses(language: Optional[str] = None):
    q = {}
    if language:
        q["language"] = language
    cursor = db.courses.find(q, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@api_router.get("/courses/{course_id}", response_model=CourseOut)
async def get_course(course_id: str):
    c = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return c


@api_router.post("/courses", response_model=CourseOut)
async def create_course(body: CourseIn, user: dict = Depends(require_teacher)):
    course_id = str(uuid.uuid4())
    lessons = [{**l.model_dump(), "id": str(uuid.uuid4())} for l in body.lessons]
    quizzes = []
    for q in body.quizzes:
        qd = q.model_dump()
        qd["id"] = str(uuid.uuid4())
        for ques in qd["questions"]:
            ques["id"] = str(uuid.uuid4())
        quizzes.append(qd)
    doc = {
        "id": course_id,
        "title": body.title,
        "description": body.description,
        "subject": body.subject,
        "language": body.language,
        "thumbnail": body.thumbnail,
        "lessons": lessons,
        "quizzes": quizzes,
        "created_by": user["id"],
        "created_at": now_utc(),
    }
    await db.courses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(require_teacher)):
    res = await db.courses.delete_one({"id": course_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"ok": True}


# ---------- Progress ----------
@api_router.post("/progress")
async def save_progress(body: ProgressIn, user: dict = Depends(get_current_user)):
    await db.progress.update_one(
        {"user_id": user["id"], "course_id": body.course_id, "lesson_id": body.lesson_id},
        {"$set": {
            "user_id": user["id"],
            "course_id": body.course_id,
            "lesson_id": body.lesson_id,
            "completed": body.completed,
            "updated_at": now_utc(),
        }},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/progress/me")
async def my_progress(user: dict = Depends(get_current_user)):
    items = await db.progress.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    attempts = await db.quiz_attempts.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    courses = await db.courses.find({}, {"_id": 0, "id": 1, "title": 1, "lessons": 1, "subject": 1, "language": 1, "thumbnail": 1}).to_list(500)

    # Aggregate per course
    by_course = {}
    for c in courses:
        total = max(len(c.get("lessons", [])), 1)
        done = sum(1 for p in items if p["course_id"] == c["id"] and p.get("completed"))
        if done > 0 or any(a["course_id"] == c["id"] for a in attempts):
            by_course[c["id"]] = {
                "course_id": c["id"],
                "title": c["title"],
                "subject": c["subject"],
                "language": c["language"],
                "thumbnail": c.get("thumbnail"),
                "completed_lessons": done,
                "total_lessons": total,
                "percent": round(done / total * 100),
            }
    avg_quiz = 0
    if attempts:
        avg_quiz = round(sum(a["score_percent"] for a in attempts) / len(attempts))
    return {
        "courses": list(by_course.values()),
        "quiz_attempts": attempts,
        "stats": {
            "courses_started": len(by_course),
            "lessons_completed": sum(1 for p in items if p.get("completed")),
            "quizzes_taken": len(attempts),
            "avg_quiz_score": avg_quiz,
        }
    }


# ---------- Quiz ----------
@api_router.post("/quiz/attempt")
async def attempt_quiz(body: QuizAttemptIn, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": body.course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    quiz = next((q for q in course.get("quizzes", []) if q["id"] == body.quiz_id), None)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    questions = quiz["questions"]
    total = len(questions)
    correct = 0
    results = []
    for i, q in enumerate(questions):
        user_ans = body.answers[i] if i < len(body.answers) else -1
        is_correct = user_ans == q["correct_index"]
        if is_correct:
            correct += 1
        results.append({
            "question": q["question"],
            "correct_index": q["correct_index"],
            "user_index": user_ans,
            "is_correct": is_correct,
        })
    score = round(correct / total * 100) if total else 0
    attempt_id = str(uuid.uuid4())
    await db.quiz_attempts.insert_one({
        "id": attempt_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "course_id": body.course_id,
        "quiz_id": body.quiz_id,
        "quiz_title": quiz["title"],
        "score_percent": score,
        "correct": correct,
        "total": total,
        "created_at": now_utc(),
    })
    return {"score_percent": score, "correct": correct, "total": total, "results": results}


# ---------- Comments (simple threaded per course) ----------
@api_router.get("/comments/{course_id}")
async def list_comments(course_id: str):
    items = await db.comments.find({"course_id": course_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/comments")
async def add_comment(body: CommentIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "course_id": body.course_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_role": user["role"],
        "text": body.text,
        "created_at": now_utc(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- WebSocket Chat (global room) ----------
class ChatHub:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(d)


hub = ChatHub()


@app.websocket("/api/ws/chat")
async def chat_ws(ws: WebSocket, token: str = ""):
    # Auth via query token
    user = None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = {"id": payload["sub"], "email": payload["email"], "role": payload["role"]}
        u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user = u
    except Exception:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await hub.connect(ws)
    try:
        # Send recent history
        hist = await db.chat_messages.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
        hist.reverse()
        await ws.send_json({"type": "history", "messages": hist})

        while True:
            data = await ws.receive_text()
            try:
                body = json.loads(data)
                text = str(body.get("text", "")).strip()
            except Exception:
                continue
            if not text:
                continue
            msg = {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "user_name": user["name"],
                "user_role": user["role"],
                "text": text[:500],
                "created_at": now_utc(),
            }
            await db.chat_messages.insert_one(msg)
            msg.pop("_id", None)
            await hub.broadcast({"type": "message", "message": msg})
    except WebSocketDisconnect:
        hub.disconnect(ws)
    except Exception as e:
        logger.error(f"WS error: {e}")
        hub.disconnect(ws)


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"message": "Rural Learn API", "status": "ok"}


# ---------- Startup: Seed ----------
DEMO_COURSES_EN = [
    {
        "title": "Basic Mathematics",
        "description": "Learn addition, subtraction, and multiplication through simple examples.",
        "subject": "Mathematics",
        "language": "en",
        "thumbnail": "https://images.unsplash.com/photo-1760009229725-7ef1990e585f?crop=entropy&cs=srgb&fm=jpg&w=600&q=60",
        "lessons": [
            {"title": "Addition Basics", "type": "video", "youtube_id": "mAvuom3uMHs", "duration_min": 6},
            {"title": "Subtraction Made Easy", "type": "video", "youtube_id": "C38B33ZywWs", "duration_min": 5},
            {"title": "Multiplication Tricks", "type": "text",
             "content": "Multiplication is repeated addition. 3 x 4 = 3 + 3 + 3 + 3 = 12. Practice your tables from 1 to 10.",
             "duration_min": 4},
            {"title": "Practice Worksheet (PDF)", "type": "pdf",
             "pdf_url": "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
             "duration_min": 10},
        ],
        "quizzes": [{
            "title": "Math Quick Check",
            "questions": [
                {"question": "What is 7 + 5?", "options": ["10", "11", "12", "13"], "correct_index": 2},
                {"question": "What is 9 - 4?", "options": ["3", "4", "5", "6"], "correct_index": 2},
                {"question": "What is 6 x 3?", "options": ["12", "15", "18", "21"], "correct_index": 2},
            ]
        }],
    },
    {
        "title": "Science for Beginners",
        "description": "Explore plants, animals, and our planet with fun short videos.",
        "subject": "Science",
        "language": "en",
        "thumbnail": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?crop=entropy&cs=srgb&fm=jpg&w=600&q=60",
        "lessons": [
            {"title": "How Plants Grow", "type": "video", "youtube_id": "tkFPyue5X3Q", "duration_min": 5},
            {"title": "The Water Cycle", "type": "video", "youtube_id": "al-do-HGuIk", "duration_min": 4},
            {"title": "Science Facts (PDF)", "type": "pdf",
             "pdf_url": "https://www.africau.edu/images/default/sample.pdf",
             "duration_min": 8},
        ],
        "quizzes": [{
            "title": "Science Check",
            "questions": [
                {"question": "Plants make food using...", "options": ["Soil", "Sunlight", "Water only", "Wind"], "correct_index": 1},
                {"question": "Water turns to vapor by...", "options": ["Freezing", "Melting", "Evaporation", "Raining"], "correct_index": 2},
            ]
        }],
    },
]

DEMO_COURSES_HI = [
    {
        "title": "हिंदी व्याकरण",
        "description": "हिंदी भाषा की मूल बातें सीखें — वर्ण, शब्द और वाक्य।",
        "subject": "भाषा",
        "language": "hi",
        "thumbnail": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?crop=entropy&cs=srgb&fm=jpg&w=600&q=60",
        "lessons": [
            {"title": "वर्णमाला परिचय", "type": "video", "youtube_id": "xdkSfbtH5O4", "duration_min": 5},
            {"title": "संज्ञा क्या है?", "type": "text",
             "content": "संज्ञा किसी व्यक्ति, वस्तु, स्थान या भाव के नाम को कहते हैं। जैसे — राम, दिल्ली, पुस्तक, प्रेम।",
             "duration_min": 3},
        ],
        "quizzes": [{
            "title": "अभ्यास",
            "questions": [
                {"question": "संज्ञा क्या है?", "options": ["क्रिया", "नाम", "विशेषण", "सर्वनाम"], "correct_index": 1},
                {"question": "हिंदी में कितने स्वर हैं?", "options": ["9", "10", "11", "13"], "correct_index": 2},
            ]
        }],
    },
]

DEMO_COURSES_TA = [
    {
        "title": "அறிவியல் அடிப்படைகள்",
        "description": "செடிகள், தண்ணீர் சுழற்சி போன்றவற்றை எளிய வழியில் கற்றுக்கொள்ளுங்கள்.",
        "subject": "அறிவியல்",
        "language": "ta",
        "thumbnail": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?crop=entropy&cs=srgb&fm=jpg&w=600&q=60",
        "lessons": [
            {"title": "தாவரங்கள் எப்படி வளர்கின்றன", "type": "video", "youtube_id": "tkFPyue5X3Q", "duration_min": 5},
            {"title": "நீர் சுழற்சி", "type": "text",
             "content": "நீர் கடலில் இருந்து ஆவியாகி, மேகமாக, மழையாக மாறி மீண்டும் நிலத்தை அடைகிறது.",
             "duration_min": 3},
        ],
        "quizzes": [{
            "title": "சரிபார்ப்பு",
            "questions": [
                {"question": "தாவரங்கள் உணவைத் தயாரிப்பது எதனால்?", "options": ["மண்", "சூரிய ஒளி", "காற்று", "இருள்"], "correct_index": 1},
            ]
        }],
    },
]


async def seed_demo(admin_id: str):
    existing = await db.courses.count_documents({})
    if existing > 0:
        return
    all_demo = DEMO_COURSES_EN + DEMO_COURSES_HI + DEMO_COURSES_TA
    for c in all_demo:
        lessons = [{**l, "id": str(uuid.uuid4())} for l in c["lessons"]]
        quizzes = []
        for q in c["quizzes"]:
            qd = {**q, "id": str(uuid.uuid4())}
            qd["questions"] = [{**qq, "id": str(uuid.uuid4())} for qq in q["questions"]]
            quizzes.append(qd)
        await db.courses.insert_one({
            "id": str(uuid.uuid4()),
            "title": c["title"],
            "description": c["description"],
            "subject": c["subject"],
            "language": c["language"],
            "thumbnail": c["thumbnail"],
            "lessons": lessons,
            "quizzes": quizzes,
            "created_by": admin_id,
            "created_at": now_utc(),
        })


async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "email": admin_email,
            "name": "Admin Teacher",
            "role": "teacher",
            "password_hash": hash_password(admin_password),
            "created_at": now_utc(),
        })
    else:
        admin_id = admin["id"]
        if not verify_password(admin_password, admin["password_hash"]):
            await db.users.update_one({"id": admin_id}, {"$set": {"password_hash": hash_password(admin_password)}})

    student_email = "student@learn.in"
    student = await db.users.find_one({"email": student_email})
    if not student:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": student_email,
            "name": "Demo Student",
            "role": "student",
            "password_hash": hash_password("student123"),
            "created_at": now_utc(),
        })
    return admin_id


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.courses.create_index("id", unique=True)
    await db.progress.create_index([("user_id", 1), ("course_id", 1), ("lesson_id", 1)], unique=True)
    admin_id = await seed_users()
    await seed_demo(admin_id)
    logger.info("Startup complete.")


# ---------- Mount ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
