import os
from typing import Dict

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

def polish_bullets(data: Dict) -> Dict:
    """Take raw user data dict and return polished bullets.
    If OpenAI key is set, call the API; otherwise return simple formatted text.
    """
    name = data.get("name", "")
    education = data.get("education", "")
    skills = data.get("skills", "")
    projects = data.get("projects", "")

    # Lightweight fallback polishing
    bullets = []
    if projects:
        for line in projects.split("\n"):
            line = line.strip()
            if not line:
                continue
            bullets.append(f"Developed {line}.")

    if not bullets:
        bullets.append("Contributed to projects using listed skills.")

    return {
        "name": name,
        "education": education,
        "skills": skills,
        "bullets": bullets,
    }
