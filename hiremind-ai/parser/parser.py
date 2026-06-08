"""Resume parsing — pdfplumber + PyMuPDF fallback."""
import re
from typing import Any, Dict, List

import pdfplumber

try:
    import fitz  # PyMuPDF
except Exception:  # noqa: BLE001
    fitz = None

SKILLS_DB: List[str] = [
    "Python", "JavaScript", "TypeScript", "React", "Node.js", "Express", "MongoDB",
    "MySQL", "PostgreSQL", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Git", "GitHub",
    "REST API", "GraphQL", "HTML", "CSS", "Tailwind", "Django", "FastAPI", "Flask",
    "LangChain", "LangGraph", "RAG", "PyTorch", "TensorFlow", "Scikit-learn", "Pandas",
    "NumPy", "Tableau", "Power BI", "Excel", "SQL", "Linux", "Bash", "CI/CD", "Jenkins",
    "Terraform", "Ansible", "Nginx", "Redis", "Elasticsearch", "JWT", "OAuth",
    "LLM", "Prompt Engineering", "NLP", "Machine Learning", "Deep Learning",
    "Computer Vision", "Data Science", "Agile", "Scrum",
]


def extract_text(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
    except Exception:  # noqa: BLE001
        text = ""
    # PyMuPDF fallback for tricky PDFs
    if (not text or len(text) < 80) and fitz is not None:
        try:
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text() + "\n"
        except Exception:  # noqa: BLE001
            pass
    return text


def extract_email(text: str) -> str:
    m = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)
    return m.group(0) if m else ""


def extract_phone(text: str) -> str:
    m = re.search(r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}", text)
    return m.group(0).strip() if m else ""


def extract_skills(text: str) -> List[str]:
    tl = text.lower()
    return [s for s in SKILLS_DB if s.lower() in tl]


SECTION_HEADERS = [
    "experience", "education", "skills", "projects",
    "certifications", "objective", "summary", "languages",
]


def extract_section(text: str, keywords: List[str]) -> str:
    lines = text.split("\n")
    capture = False
    section_lines: List[str] = []
    for line in lines:
        ll = line.lower().strip()
        if any(kw in ll for kw in keywords):
            capture = True
            continue
        if capture:
            if any(h in ll for h in SECTION_HEADERS if not any(kw in ll for kw in keywords)):
                break
            section_lines.append(line.strip())
    return " ".join(section_lines[:6]).strip()


def extract_projects(text: str) -> List[str]:
    lines = text.split("\n")
    projects: List[str] = []
    in_section = False
    for line in lines:
        if "project" in line.lower() and len(line) < 30:
            in_section = True
            continue
        if in_section:
            s = line.strip()
            if s and 5 < len(s) < 80:
                projects.append(s)
            if len(projects) >= 5:
                break
    return projects


def parse_resume(file_path: str) -> Dict[str, Any]:
    text = extract_text(file_path)
    name = text.split("\n")[0].strip() if text else "Unknown"

    return {
        "name": name,
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "education": extract_section(text, ["education", "mca", "bca", "btech", "mtech", "b.e", "m.e"]),
        "experience": extract_section(text, ["experience", "internship", "work history", "employment"]),
        "projects": extract_projects(text),
        "certifications": extract_section(text, ["certification", "certificate", "course"]),
        "rawText": text[:2000],
    }
